#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

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
  "This server is read-only. It exposes Sentinel Recovery's public service catalog and quote-request contract as MCP resources. It has no tools, submits no request, moves no funds, authorizes no payment, creates no service entitlement, and never requests credentials, keys, signatures, wallet connections, custody, or wallet control. A complete written quote is required before any service payment.";

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
      version: "0.1.0",
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

  return server;
}

export async function runStdio() {
  const server = createSentinelServer();
  await server.connect(new StdioServerTransport());
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

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
