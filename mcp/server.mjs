#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import {
  PreflightInputError,
  preflightAgentPaymentBoundary,
} from "./preflight.mjs";
import {
  prepareServiceQuoteRequest,
  quoteRequestInputSchema,
  quoteRequestOutputSchema,
} from "./quote-request.mjs";
import { preflightX402V2PaymentRequired } from "./x402-payment-required.mjs";

export const MAX_RESOURCE_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export const RESOURCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: "sentinel-service-catalog",
    title: "Sentinel Recovery Service Catalog",
    uri: "sentinel://services/catalog",
    contractType: "service-catalog",
    sourceUrl:
      "https://terminallylazy.github.io/sentinel-recovery-support/services.json",
    description:
      "Fixed-scope public-data services, deliverables, prices, and request boundaries.",
  }),
  Object.freeze({
    name: "sentinel-quote-request-contract",
    title: "Sentinel Recovery Quote Request Contract",
    uri: "sentinel://services/quote-request-contract",
    contractType: "quote-request",
    sourceUrl:
      "https://terminallylazy.github.io/sentinel-recovery-support/service-request.json",
    description:
      "Transport-aware schema and workflow for requesting a written quote without moving funds.",
  }),
]);

const SERVER_INSTRUCTIONS =
  "This server is read-only. It exposes Sentinel Recovery's public service catalog and quote-request contract as MCP resources, two deterministic preflight tools for inline public documents, and one local tool that prepares but never submits a public quote-request draft. Each tool makes no network requests, executes no supplied content, submits no request, moves no funds, authorizes no payment, creates no service entitlement, and never requests credentials, keys, signatures, wallet connections, custody, or wallet control. A complete written quote is required before any service payment.";

const preflightDocumentSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(120)
    .describe("A non-sensitive label for the supplied public document."),
  mediaType: z
    .enum(["application/json", "text/markdown", "text/plain"])
    .default("text/plain")
    .describe("How the inline document should be parsed."),
  content: z
    .string()
    .min(1)
    .describe("Inline public document content. URLs are not fetched."),
});

const evidenceSchema = z.object({
  documentName: z.string().max(32),
  locator: z.string().max(240),
  excerpt: z.string().max(180),
  untrustedEvidence: z.literal(true),
});

const findingSchema = z.object({
  id: z.string(),
  boundary: z.string(),
  status: z.enum(["clear", "ambiguous", "missing"]),
  evidence: evidenceSchema,
  risk: z.string(),
  correction: z.string(),
});

class ResourceReadError extends Error {
  constructor(message) {
    super(message);
    this.name = "ResourceReadError";
  }
}

function resourceError(resource, detail) {
  return new ResourceReadError(`Unable to read ${resource.title}: ${detail}`);
}

function matchesContractShape(resource, value) {
  if (resource.contractType === "service-catalog") {
    return (
      Array.isArray(value.offerings) &&
      value.offerings.every(
        (offering) =>
          offering !== null &&
          typeof offering === "object" &&
          typeof offering.id === "string" &&
          typeof offering.priceUsd === "number",
      )
    );
  }

  return (
    value.requestSchema !== null &&
    typeof value.requestSchema === "object" &&
    !Array.isArray(value.requestSchema) &&
    value.workflow !== null &&
    typeof value.workflow === "object" &&
    value.workflow.completeQuoteRequiredBeforePayment === true
  );
}

function contractLabel(resource) {
  return resource.contractType === "service-catalog"
    ? "Sentinel service catalog contract"
    : "Sentinel quote-request contract";
}

async function readCappedBody(response, resource) {
  if (!response.body || typeof response.body.getReader !== "function") {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_RESOURCE_BYTES) {
      throw resourceError(
        resource,
        `the response exceeds ${MAX_RESOURCE_BYTES} bytes. Inspect the canonical URL ${resource.sourceUrl} directly.`,
      );
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk =
        value instanceof Uint8Array ? value : new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_RESOURCE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The size error below is the actionable failure for the client.
        }
        throw resourceError(
          resource,
          `the response exceeds ${MAX_RESOURCE_BYTES} bytes. Inspect the canonical URL ${resource.sourceUrl} directly.`,
        );
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof ResourceReadError) {
      throw error;
    }
    throw resourceError(
      resource,
      `the response body could not be read. Retry later or inspect the canonical URL ${resource.sourceUrl} directly.`,
    );
  } finally {
    reader.releaseLock?.();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchCanonicalJson(resource, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(resource.sourceUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError");
    const detail = timedOut
      ? `the canonical URL timed out after ${FETCH_TIMEOUT_MS} ms. Retry later or inspect the canonical URL ${resource.sourceUrl} directly.`
      : `the canonical URL could not be reached. Retry later or inspect the canonical URL ${resource.sourceUrl} directly.`;
    throw resourceError(resource, detail);
  }

  if (!response.ok) {
    throw resourceError(
      resource,
      `the canonical URL returned HTTP ${response.status}. Retry later or inspect the canonical URL ${resource.sourceUrl} directly.`,
    );
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESOURCE_BYTES) {
    throw resourceError(
      resource,
      `the response exceeds ${MAX_RESOURCE_BYTES} bytes. Inspect the canonical URL ${resource.sourceUrl} directly.`,
    );
  }

  const bytes = await readCappedBody(response, resource);

  let parsed;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(text);
  } catch {
    throw resourceError(
      resource,
      `the canonical URL did not return valid JSON. Inspect the canonical URL ${resource.sourceUrl} directly.`,
    );
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw resourceError(
      resource,
      `the canonical URL did not return a JSON object. Inspect the canonical URL ${resource.sourceUrl} directly.`,
    );
  }

  if (!matchesContractShape(resource, parsed)) {
    throw resourceError(
      resource,
      `the JSON does not match the ${contractLabel(resource)}. Inspect the canonical URL ${resource.sourceUrl} directly.`,
    );
  }

  return parsed;
}

export function createSentinelServer({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("createSentinelServer requires a fetch implementation");
  }

  const server = new McpServer(
    {
      name: "sentinel-recovery-mcp-server",
      version: "0.4.1",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  for (const resource of RESOURCE_DEFINITIONS) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        title: resource.title,
        description: resource.description,
        mimeType: "application/json",
      },
      async (uri) => {
        const value = await fetchCanonicalJson(resource, fetchImpl);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(value, null, 2),
            },
          ],
        };
      },
    );
  }

  server.registerTool(
    "prepare_agent_payment_boundary_quote_request",
    {
      title: "Prepare Sentinel Service Quote Request",
      description:
        "Prepare a complete public GitHub quote-request draft for Sentinel's fixed-scope Agent Payment Boundary Review from one or two public HTTPS URLs without credentials, query strings, fragments, or non-public hosts. This local read-only tool does not submit the request, fetch URLs, connect a wallet, move funds, authorize payment, or create a service entitlement.",
      inputSchema: quoteRequestInputSchema,
      outputSchema: quoteRequestOutputSchema,
      annotations: {
        title: "Prepare Sentinel Service Quote Request",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const structuredContent = prepareServiceQuoteRequest(input);
      return {
        content: [
          {
            type: "text",
            text:
              "Prepared a complete public GitHub quote-request draft. Nothing was submitted, no credential was used, no payment was authorized, and no funds moved. Inspect structuredContent, then submit only within the requester's own communication policy.",
          },
        ],
        structuredContent,
      };
    },
  );

  server.registerTool(
    "preflight_agent_payment_boundary",
    {
      title: "Agent Payment Boundary Preflight",
      description:
        "Deterministically inspect one or two inline public agent/payment documents for authority, quote, replay, receipt, wallet-secret, and integrity boundaries. This free preflight does not fetch URLs, execute content, submit a request, or move funds.",
      inputSchema: {
        documents: z
          .array(preflightDocumentSchema)
          .min(1)
          .max(2)
          .describe("One or two inline public documents, at most 100 KiB combined."),
        question: z
          .string()
          .max(500)
          .optional()
          .describe("Optional non-sensitive context; it does not change the fixed checks."),
      },
      outputSchema: {
        schemaVersion: z.literal("1.0"),
        kind: z.literal("agent-payment-boundary-preflight"),
        scope: z.object({
          documentsAnalyzed: z.number().int().min(1).max(2),
          combinedBytes: z.number().int().nonnegative(),
          deterministic: z.literal(true),
          networkRequests: z.literal(false),
          codeExecution: z.literal(false),
          walletAccess: z.literal(false),
        }),
        summary: z.object({
          clear: z.number().int().nonnegative(),
          ambiguous: z.number().int().nonnegative(),
          missing: z.number().int().nonnegative(),
        }),
        findings: z.array(findingSchema).length(11),
        escalation: z.object({
          optional: z.literal(true),
          serviceId: z.literal("agent-payment-boundary-review"),
          priceUsd: z.literal(49),
          sampleUrl: z.string().url(),
          quoteRequestContractUrl: z.string().url(),
          requestMovesFunds: z.literal(false),
          requestAuthorizesPayment: z.literal(false),
          completeWrittenQuoteRequired: z.literal(true),
          payerMustFollowOwnPolicy: z.literal(true),
        }),
        disclaimer: z.string(),
      },
      annotations: {
        title: "Agent Payment Boundary Preflight",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const structuredContent = preflightAgentPaymentBoundary(input);
        return {
          content: [
            {
              type: "text",
              text:
                `Agent payment-boundary preflight complete: ` +
                `${structuredContent.summary.clear} clear, ` +
                `${structuredContent.summary.ambiguous} ambiguous, ` +
                `${structuredContent.summary.missing} missing. ` +
                `Inspect structuredContent for the bounded findings. ` +
                structuredContent.disclaimer,
            },
          ],
          structuredContent,
        };
      } catch (error) {
        if (error instanceof PreflightInputError) {
          return {
            isError: true,
            content: [{ type: "text", text: error.message }],
          };
        }
        throw error;
      }
    },
  );

  server.registerTool(
    "preflight_x402_v2_payment_required",
    {
      title: "x402 v2 PaymentRequired EIP-3009 Preflight",
      description:
        "Deterministically inspect one decoded inline x402 v2 PaymentRequired JSON document under a closed-world exact-EVM EIP-3009 Sentinel safety profile. This free preflight does not fetch URLs, execute content, verify signatures or settlement, connect a wallet, or move funds.",
      inputSchema: {
        document: z.object({
          name: z
            .string()
            .min(1)
            .max(120)
            .describe("A non-sensitive label for the supplied public document."),
          content: z
            .string()
            .min(1)
            .describe("Decoded inline PaymentRequired JSON. URLs are not fetched."),
        }),
      },
      outputSchema: {
        schemaVersion: z.literal("1.0"),
        kind: z.literal("x402-v2-payment-required-preflight"),
        scope: z.object({
          documentsAnalyzed: z.literal(1),
          combinedBytes: z.number().int().nonnegative(),
          deterministic: z.literal(true),
          networkRequests: z.literal(false),
          codeExecution: z.literal(false),
          walletAccess: z.literal(false),
          decodedJsonOnly: z.literal(true),
          profile: z.literal("x402-v2-exact-evm-eip3009-sentinel-safe"),
          specificationCommit: z.literal(
            "8b1abaeaef282e6307a2936b102c6d9223e61802",
          ),
        }),
        summary: z.object({
          clear: z.number().int().nonnegative(),
          ambiguous: z.number().int().nonnegative(),
          missing: z.number().int().nonnegative(),
        }),
        findings: z.array(findingSchema).length(9),
        limitations: z.object({
          paymentRequiredOnly: z.literal(true),
          payerPolicyEvaluated: z.literal(false),
          paymentPayloadVerified: z.literal(false),
          signaturesVerified: z.literal(false),
          settlementVerified: z.literal(false),
          receiptVerified: z.literal(false),
          networkExistenceVerified: z.literal(false),
          assetContractBehaviorVerified: z.literal(false),
          eip712DomainVerified: z.literal(false),
          tokenOrRecipientOwnershipVerified: z.literal(false),
          implementationTested: z.literal(false),
        }),
        escalation: z.object({
          optional: z.literal(true),
          serviceId: z.literal("agent-payment-boundary-review"),
          priceUsd: z.literal(49),
          sampleUrl: z.string().url(),
          quoteRequestContractUrl: z.string().url(),
          requestMovesFunds: z.literal(false),
          requestAuthorizesPayment: z.literal(false),
          completeWrittenQuoteRequired: z.literal(true),
          payerMustFollowOwnPolicy: z.literal(true),
        }),
        disclaimer: z.string(),
      },
      annotations: {
        title: "x402 v2 PaymentRequired EIP-3009 Preflight",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const structuredContent = preflightX402V2PaymentRequired(input);
        return {
          content: [
            {
              type: "text",
              text:
                `x402 v2 PaymentRequired preflight complete: ` +
                `${structuredContent.summary.clear} clear, ` +
                `${structuredContent.summary.ambiguous} ambiguous, ` +
                `${structuredContent.summary.missing} missing. ` +
                `Inspect structuredContent for the bounded findings. ` +
                structuredContent.disclaimer,
            },
          ],
          structuredContent,
        };
      } catch (error) {
        if (error instanceof PreflightInputError) {
          return {
            isError: true,
            content: [{ type: "text", text: error.message }],
          };
        }
        throw error;
      }
    },
  );

  return server;
}

export async function runStdio() {
  const server = createSentinelServer();
  await server.connect(new StdioServerTransport());
}

let isDirectExecution = false;
if (process.argv[1]) {
  try {
    isDirectExecution =
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    isDirectExecution = false;
  }
}

if (isDirectExecution) {
  runStdio().catch((error) => {
    console.error(
      `Sentinel Recovery MCP server failed to start: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
  });
}
