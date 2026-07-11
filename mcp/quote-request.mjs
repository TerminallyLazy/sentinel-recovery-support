import { isIP } from "node:net";

import * as z from "zod/v4";

const GITHUB_REPOSITORY = "TerminallyLazy/sentinel-recovery-support";
const GITHUB_NEW_ISSUE_URL =
  "https://github.com/TerminallyLazy/sentinel-recovery-support/issues/new";
const GITHUB_API_ENDPOINT =
  "https://api.github.com/repos/TerminallyLazy/sentinel-recovery-support/issues";
const MAX_PUBLIC_URL_LENGTH = 2048;

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isPublicHost(hostnameValue) {
  const hostname = hostnameValue
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    [".localhost", ".local", ".localdomain", ".internal", ".home", ".lan"].some(
      (suffix) => hostname.endsWith(suffix),
    )
  ) {
    return false;
  }

  const version = isIP(hostname);
  if (version === 4) {
    const [first, second, third] = hostname.split(".").map(Number);
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0 && third === 0) ||
      (first === 192 && second === 0 && third === 2) ||
      (first === 192 && second === 88 && third === 99) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 198 && second === 51 && third === 100) ||
      (first === 203 && second === 0 && third === 113)
    );
  }
  if (version === 6) {
    return !(
      hostname === "::" ||
      hostname === "::1" ||
      hostname.startsWith("::ffff:") ||
      hostname.startsWith("64:ff9b:") ||
      hostname.startsWith("100:") ||
      hostname.startsWith("2001:db8:") ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      /^fe[89ab]/u.test(hostname) ||
      hostname.startsWith("ff")
    );
  }

  return hostname.includes(".");
}

const publicHttpsUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PUBLIC_URL_LENGTH)
  .superRefine((value, context) => {
    const url = parseUrl(value);
    if (!url) {
      context.addIssue({
        code: "custom",
        message: "Public document URLs must be valid URLs.",
      });
      return;
    }
    if (url.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        message: "Public document URLs must use HTTPS.",
      });
    }
    if (url.username !== "" || url.password !== "") {
      context.addIssue({
        code: "custom",
        message: "Public document URLs must not include credentials.",
      });
    }
    if (url.search !== "" || value.includes("?")) {
      context.addIssue({
        code: "custom",
        message:
          "Public issue drafts cannot include URL query parameters because they may expose credentials.",
      });
    }
    if (url.hash !== "" || value.includes("#")) {
      context.addIssue({
        code: "custom",
        message: "Public document URLs must not include fragments.",
      });
    }
    if (!isPublicHost(url.hostname)) {
      context.addIssue({
        code: "custom",
        message: "Public document URLs must identify public hosts.",
      });
    }
  });

const singleLine = (maximum, description) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !/[\r\n]/u.test(value), {
      message: "Must be a single line.",
    })
    .describe(description);

export const quoteRequestInputSchema = z.object({
  serviceId: z.literal("agent-payment-boundary-review"),
  requestTransport: z.literal("github-issue"),
  publicDocumentUrls: z
    .array(publicHttpsUrlSchema)
    .min(1)
    .max(2)
    .refine(
      (values) =>
        new Set(values.map((value) => parseUrl(value)?.href ?? value)).size ===
        values.length,
      {
        message: "Public document URLs must be unique.",
      },
    ),
  intendedUse: singleLine(
    500,
    "Optional public question or intended use for the written review.",
  ).optional(),
  preferredFormat: z.enum(["HTML", "Markdown"]).optional(),
  timingNeed: singleLine(200, "Optional public timing need.").optional(),
});

const githubDestinationSchema = z.object({
  method: z.literal("github-issue"),
  visibility: z.literal("public"),
  repository: z.literal(GITHUB_REPOSITORY),
  webUrl: z.string().url(),
  apiEndpoint: z.string().url(),
  requesterOwnCredentialRequiredToSubmit: z.literal(true),
});

export const quoteRequestOutputSchema = z.object({
  schemaVersion: z.literal("1.0"),
  kind: z.literal("sentinel-service-quote-request-draft"),
  complete: z.literal(true),
  packetStatus: z.literal("complete-unsubmitted-request"),
  contract: z.object({
    schemaVersion: z.literal("1.0"),
    canonicalUrl: z.literal(
      "https://terminallylazy.github.io/sentinel-recovery-support/service-request.json",
    ),
  }),
  serviceId: z.literal("agent-payment-boundary-review"),
  servicePriceUsd: z.literal(49),
  requestTransport: z.literal("github-issue"),
  request: z.object({
    serviceId: z.literal("agent-payment-boundary-review"),
    requestTransport: z.literal("github-issue"),
    chainId: z.literal(1),
    publicDocumentUrls: z.array(publicHttpsUrlSchema).min(1).max(2),
    intendedUse: z.string().optional(),
    preferredFormat: z.enum(["HTML", "Markdown"]).optional(),
    timingNeed: z.string().optional(),
  }),
  destination: githubDestinationSchema,
  requestTitle: z.string(),
  requestBody: z.string(),
  submissionRequirements: z.object({
    requesterMustConfirmPublicFactsOnly: z.literal(true),
    requesterMustConfirmRequestMovesNoFundsOrAuthorizesPayment: z.literal(true),
    requesterMustConfirmWaitForCompleteWrittenQuote: z.literal(true),
  }),
  safety: z.object({
    publicFactsOnly: z.literal(true),
    requestMovesFunds: z.literal(false),
    requestAuthorizesPayment: z.literal(false),
    paymentInstructionsIncluded: z.literal(false),
    completeWrittenQuoteRequired: z.literal(true),
    payerMustFollowOwnPolicy: z.literal(true),
    communicationAuthorityRequired: z.literal(true),
    networkRequests: z.literal(false),
    urlsFetched: z.literal(false),
    publicAvailabilityVerified: z.literal(false),
    walletAccess: z.literal(false),
    credentialsRequested: z.literal(false),
    signaturesRequested: z.literal(false),
    createsServiceEntitlement: z.literal(false),
    submitted: z.literal(false),
  }),
});

export function prepareServiceQuoteRequest(input) {
  const request = quoteRequestInputSchema.parse(input);
  const publicDocumentUrls = request.publicDocumentUrls.join(", ");
  const requestTitle = `Sentinel quote request: ${request.serviceId}`;
  const requestBody = [
    "Sentinel Recovery service request",
    `Service ID: ${request.serviceId}`,
    "Request transport: github-issue",
    "Network: Ethereum Mainnet (chain ID 1)",
    "Ethereum Mainnet transaction hash (case services): not applicable (agent review)",
    `Public manifest, document, or x402 resource URL(s) (agent review): ${publicDocumentUrls}`,
    `Specific question or intended use (optional): ${request.intendedUse ?? "not provided"}`,
    `Preferred output format (optional — HTML or Markdown): ${request.preferredFormat ?? "not provided"}`,
    `Timing need (optional): ${request.timingNeed ?? "not provided"}`,
    "",
    "This is a quote request only. It moves no funds and authorizes no payment. Do not begin work or pay until Sentinel replies in this issue with a complete written quote.",
    "This issue is public. Do not include identity documents, confidential material, credentials, PaymentPayload, signature headers, private keys, seed phrases, wallet signatures, or wallet connections.",
  ].join("\n");
  const webUrl = `${GITHUB_NEW_ISSUE_URL}?template=service-request.yml&title=${encodeURIComponent(requestTitle)}`;

  return {
    schemaVersion: "1.0",
    kind: "sentinel-service-quote-request-draft",
    complete: true,
    packetStatus: "complete-unsubmitted-request",
    contract: {
      schemaVersion: "1.0",
      canonicalUrl:
        "https://terminallylazy.github.io/sentinel-recovery-support/service-request.json",
    },
    serviceId: request.serviceId,
    servicePriceUsd: 49,
    requestTransport: request.requestTransport,
    request: {
      serviceId: request.serviceId,
      requestTransport: request.requestTransport,
      chainId: 1,
      publicDocumentUrls: request.publicDocumentUrls,
      ...(request.intendedUse === undefined
        ? {}
        : { intendedUse: request.intendedUse }),
      ...(request.preferredFormat === undefined
        ? {}
        : { preferredFormat: request.preferredFormat }),
      ...(request.timingNeed === undefined ? {} : { timingNeed: request.timingNeed }),
    },
    destination: {
      method: "github-issue",
      visibility: "public",
      repository: GITHUB_REPOSITORY,
      webUrl,
      apiEndpoint: GITHUB_API_ENDPOINT,
      requesterOwnCredentialRequiredToSubmit: true,
    },
    requestTitle,
    requestBody,
    submissionRequirements: {
      requesterMustConfirmPublicFactsOnly: true,
      requesterMustConfirmRequestMovesNoFundsOrAuthorizesPayment: true,
      requesterMustConfirmWaitForCompleteWrittenQuote: true,
    },
    safety: {
      publicFactsOnly: true,
      requestMovesFunds: false,
      requestAuthorizesPayment: false,
      paymentInstructionsIncluded: false,
      completeWrittenQuoteRequired: true,
      payerMustFollowOwnPolicy: true,
      communicationAuthorityRequired: true,
      networkRequests: false,
      urlsFetched: false,
      publicAvailabilityVerified: false,
      walletAccess: false,
      credentialsRequested: false,
      signaturesRequested: false,
      createsServiceEntitlement: false,
      submitted: false,
    },
  };
}
