import { createHash } from "node:crypto";
import { isIP } from "node:net";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPublicHost(hostnameValue) {
  const hostname = hostnameValue
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "local" ||
    hostname.endsWith(".local")
  ) {
    return false;
  }

  const version = isIP(hostname);
  if (version === 4) {
    const [first, second] = hostname.split(".").map(Number);
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19))
    );
  }
  if (version === 6) {
    return !(
      hostname === "::" ||
      hostname === "::1" ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      /^fe[89ab]/.test(hostname) ||
      hostname.startsWith("2001:db8:") ||
      hostname.startsWith("::ffff:")
    );
  }
  return true;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function canonicalJsonDigest(value) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function requireUuid(name, value) {
  if (!UUID_V4.test(value ?? "")) {
    throw new Error(`${name} must be a UUID v4`);
  }
}

function requireTimestamp(name, value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value ?? "")) {
    throw new Error(`${name} must use canonical RFC3339 UTC form`);
  }
  const milliseconds = Date.parse(value ?? "");
  if (
    !Number.isFinite(milliseconds) ||
    new Date(milliseconds).toISOString() !== value
  ) {
    throw new Error(`${name} must use canonical RFC3339 UTC form`);
  }

  return milliseconds;
}

function validateRequest(request, service) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("request must be a JSON object");
  }

  if (request.serviceId !== service.id) {
    throw new Error("request serviceId does not match the selected service");
  }

  const allowedFields = new Set([
    "serviceId",
    "requestTransport",
    "chainId",
    "transactionHash",
    "publicDocumentUrls",
    "replyEmail",
    "claimantRole",
    "intendedUse",
    "preferredFormat",
    "timingNeed",
  ]);
  for (const field of Object.keys(request)) {
    if (!allowedFields.has(field)) {
      throw new Error(`undeclared request field ${field}`);
    }
  }
  for (const field of [
    "transactionHash",
    "replyEmail",
    "claimantRole",
    "intendedUse",
    "preferredFormat",
    "timingNeed",
  ]) {
    if (field in request && typeof request[field] !== "string") {
      throw new Error(`${field} must be a string`);
    }
  }
  if (
    "preferredFormat" in request &&
    !["HTML", "Markdown"].includes(request.preferredFormat)
  ) {
    throw new Error("preferredFormat must be HTML or Markdown");
  }
  if ("chainId" in request && request.chainId !== 1) {
    throw new Error("chainId must be 1");
  }
  if (
    "transactionHash" in request &&
    !/^0x[0-9a-f]{64}$/i.test(request.transactionHash)
  ) {
    throw new Error("transactionHash must be a 32-byte Ethereum hash");
  }

  if (!['email', 'github-issue'].includes(request.requestTransport)) {
    throw new Error("requestTransport must be email or github-issue");
  }
  if (
    request.requestTransport === "email" &&
    (typeof request.replyEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.replyEmail))
  ) {
    throw new Error("email requests require a valid replyEmail");
  }

  if (service.id === "agent-payment-boundary-review") {
    if (
      !Array.isArray(request.publicDocumentUrls) ||
      request.publicDocumentUrls.length < 1 ||
      request.publicDocumentUrls.length > 2 ||
      request.publicDocumentUrls.some(
        (url) => typeof url !== "string" || !url.startsWith("https://"),
      )
    ) {
      throw new Error("agent review requests require one or two public HTTPS URLs");
    }
    if (new Set(request.publicDocumentUrls).size !== request.publicDocumentUrls.length) {
      throw new Error("publicDocumentUrls must be unique");
    }
    for (const value of request.publicDocumentUrls) {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new Error("publicDocumentUrls must contain valid HTTPS URLs");
      }
      if (url.protocol !== "https:") {
        throw new Error("publicDocumentUrls must use HTTPS");
      }
      if (url.username || url.password) {
        throw new Error("publicDocumentUrls must not contain credentials");
      }
      if (url.hash) {
        throw new Error("publicDocumentUrls must not contain fragments");
      }
      if (!isPublicHost(url.hostname)) {
        throw new Error("publicDocumentUrls must identify public hosts");
      }
    }
  } else if (
    request.chainId !== 1 ||
    !/^0x[0-9a-f]{64}$/i.test(request.transactionHash ?? "")
  ) {
    throw new Error("case service requests require chainId 1 and a transactionHash");
  }
}

export function createServiceQuote({
  request,
  services,
  paymentContract,
  assetSymbol,
  amountBaseUnits,
  quoteId,
  paymentReference,
  issuedAt,
  expiresAt,
  payable = false,
}) {
  const service = services.offerings.find(({ id }) => id === request?.serviceId);
  if (!service) {
    throw new Error("unknown serviceId");
  }
  if (
    service.requestOnly === true ||
    service.canonicalServicePaymentQuoteEligible === false
  ) {
    throw new Error(
      "request-only services require a separately human-approved SOW and are not eligible for a canonical service-payment quote",
    );
  }

  validateRequest(request, service);
  requireUuid("quoteId", quoteId);
  requireUuid("paymentReference", paymentReference);
  if (quoteId.toLowerCase() === paymentReference.toLowerCase()) {
    throw new Error("quoteId and paymentReference must be different");
  }

  const issuedMilliseconds = requireTimestamp("issuedAt", issuedAt);
  const expiresMilliseconds = requireTimestamp("expiresAt", expiresAt);
  const maximumValidityMilliseconds =
    paymentContract.quote.maxValidityDays * 24 * 60 * 60 * 1000;
  if (
    expiresMilliseconds <= issuedMilliseconds ||
    expiresMilliseconds - issuedMilliseconds > maximumValidityMilliseconds
  ) {
    throw new Error(
      `quote validity must be greater than zero and at most ${paymentContract.quote.maxValidityDays} days`,
    );
  }

  const asset = paymentContract.supportedAssets.find(
    ({ symbol }) => symbol === assetSymbol,
  );
  if (!asset) {
    throw new Error("asset is not supported by the canonical payment contract");
  }

  let exactAmount = amountBaseUnits;
  if (["USDC", "USDT"].includes(asset.symbol)) {
    const catalogAmount = (
      BigInt(service.priceUsd) *
      10n ** BigInt(asset.decimals)
    ).toString();
    if (exactAmount && exactAmount !== catalogAmount) {
      throw new Error(
        `${asset.symbol} amountBaseUnits must equal the catalog price ${catalogAmount}`,
      );
    }
    exactAmount = catalogAmount;
  }
  if (!/^[1-9][0-9]*$/.test(exactAmount ?? "")) {
    throw new Error("amountBaseUnits must be a positive base-10 integer");
  }

  const requestFingerprint = createHash("sha256")
    .update(canonicalize(request))
    .digest("hex");

  return {
    schemaVersion: "1.0",
    kind: "sentinel-service-quote",
    complete: true,
    demonstration: false,
    payable,
    approvalState: payable ? "approved" : "draft",
    issuance: {
      humanApproved: payable,
      channel: request.requestTransport,
      issuerEmail: paymentContract.quote.issuerEmail,
      deliveryRequiredThroughSelectedReplyChannel: true,
      payerMustVerifySentinelControlledReplySource: true,
      standaloneCryptographicSignaturePresent: false,
    },
    quoteId,
    serviceId: service.id,
    requestFingerprint: `sha256:${requestFingerprint}`,
    priceUsd: service.priceUsd,
    asset: {
      symbol: asset.symbol,
      kind: asset.kind,
      decimals: asset.decimals,
      contractAddress: asset.contractAddress,
    },
    amountBaseUnits: exactAmount,
    chainId: paymentContract.network.chainId,
    recipient: paymentContract.recipient.address,
    paymentReference,
    issuedAt: new Date(issuedMilliseconds).toISOString(),
    expiresAt: new Date(expiresMilliseconds).toISOString(),
    deliverable: service.deliverable,
    turnaround: service.turnaroundLabel,
    cancellationAndRefundTerms:
      "The requester may cancel before payment. A verified on-chain payment is irreversible and non-refundable; Sentinel will provide only the quoted fixed-scope deliverable. Duplicate, late, partial, or excess receipts require manual review and do not expand the entitlement.",
    authorization: {
      requestMovesFunds: false,
      requestAuthorizesPayment: false,
      metadataExpandsPayerAuthority: false,
      payerMustFollowOwnPolicy: true,
      recipientHumanAcceptanceRequired: false,
      outboundWalletActionRequiresHumanAuthorization: true,
    },
    canonicalContracts: {
      servicePayment: paymentContract.canonicalUrl,
      serviceRequest: paymentContract.serviceRequestContract,
    },
    contractSnapshots: {
      services: {
        canonicalUrl: paymentContract.serviceCatalog,
        canonicalJsonSha256: canonicalJsonDigest(services),
      },
      servicePayment: {
        canonicalUrl: paymentContract.canonicalUrl,
        canonicalJsonSha256: canonicalJsonDigest(paymentContract),
      },
    },
    paymentInstructions: payable
      ? "Pay only the exact quoted asset and base-unit amount on Ethereum Mainnet to the canonical recipient before expiry, and return the transaction hash with the quote ID. Never provide keys, signatures, wallet connections, credentials, or PaymentPayload."
      : "Draft only. Do not pay this unapproved quote. A human-approved quote must be issued through the selected reply channel before any payment.",
  };
}
