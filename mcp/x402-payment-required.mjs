import {
  PreflightInputError,
  preparePreflightDocuments,
} from "./preflight.mjs";

const SITE_BASE = "https://terminallylazy.github.io/sentinel-recovery-support/";
const SPECIFICATION_COMMIT = "8b1abaeaef282e6307a2936b102c6d9223e61802";
const MAX_ACCEPTS = 64;
const MAX_TIMEOUT_SECONDS = 86_400;
const MAX_UINT256 = (1n << 256n) - 1n;

const rootKeys = new Set([
  "x402Version",
  "error",
  "resource",
  "accepts",
  "extensions",
]);
const resourceKeys = new Set([
  "url",
  "description",
  "mimeType",
  "serviceName",
  "tags",
  "iconUrl",
]);
const requirementKeys = new Set([
  "scheme",
  "network",
  "amount",
  "asset",
  "payTo",
  "maxTimeoutSeconds",
  "extra",
]);
const extraKeys = new Set(["assetTransferMethod", "name", "version"]);
const x402Locator = /^(?:\/|\/(?:x402Version|error|resource|resource\/(?:url|description|mimeType|serviceName|tags|tags\/\d+|iconUrl)|accepts|accepts\/\d+|accepts\/\d+\/(?:scheme|network|amount|asset|payTo|maxTimeoutSeconds|extra)|accepts\/\d+\/extra\/(?:assetTransferMethod|name|version)|extensions))$/;

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return isPlainRecord(value) && Object.keys(value).every((key) => allowed.has(key));
}

function isBoundedString(value, maximum, { nonempty = false } = {}) {
  return (
    typeof value === "string" &&
    value.length <= maximum &&
    (!nonempty || value.length > 0)
  );
}

function isPrintableAscii(value, maximum) {
  return (
    isBoundedString(value, maximum, { nonempty: true }) &&
    /^[\x20-\x7e]+$/.test(value)
  );
}

function isHttpUrl(value) {
  if (!isBoundedString(value, 2_048, { nonempty: true })) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isNonZeroEthereumAddress(value) {
  return (
    typeof value === "string" &&
    /^0x[0-9a-f]{40}$/i.test(value) &&
    !/^0x0{40}$/i.test(value)
  );
}

function isCanonicalEip155Network(value) {
  return typeof value === "string" && /^eip155:[1-9][0-9]{0,31}$/.test(value);
}

function isPositiveUint256(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) {
    return false;
  }
  try {
    const amount = BigInt(value);
    return amount > 0n && amount <= MAX_UINT256;
  } catch {
    return false;
  }
}

function isValidResource(value) {
  if (!hasOnlyKeys(value, resourceKeys) || !isHttpUrl(value.url)) {
    return false;
  }
  if (
    value.description !== undefined &&
    !isBoundedString(value.description, 2_048)
  ) {
    return false;
  }
  if (
    value.mimeType !== undefined &&
    !(
      isBoundedString(value.mimeType, 120, { nonempty: true }) &&
      /^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/.test(value.mimeType)
    )
  ) {
    return false;
  }
  if (
    value.serviceName !== undefined &&
    !isPrintableAscii(value.serviceName, 32)
  ) {
    return false;
  }
  if (
    value.tags !== undefined &&
    !(
      Array.isArray(value.tags) &&
      value.tags.length <= 5 &&
      value.tags.every((tag) => isPrintableAscii(tag, 32))
    )
  ) {
    return false;
  }
  return value.iconUrl === undefined || isHttpUrl(value.iconUrl);
}

function transferMethod(value) {
  return value?.assetTransferMethod ?? "eip3009";
}

function isValidExactEvmExtra(value) {
  return (
    hasOnlyKeys(value, extraKeys) &&
    transferMethod(value) === "eip3009" &&
    isPrintableAscii(value.name, 64) &&
    isPrintableAscii(value.version, 32)
  );
}

function isValidRequirementContainer(value) {
  return hasOnlyKeys(value, requirementKeys);
}

function hasValidSchemeAndNetwork(value) {
  return (
    isValidRequirementContainer(value) &&
    value.scheme === "exact" &&
    isCanonicalEip155Network(value.network)
  );
}

function hasValidAmountAndTimeout(value) {
  return (
    isValidRequirementContainer(value) &&
    isPositiveUint256(value.amount) &&
    Number.isSafeInteger(value.maxTimeoutSeconds) &&
    value.maxTimeoutSeconds > 0 &&
    value.maxTimeoutSeconds <= MAX_TIMEOUT_SECONDS
  );
}

function hasValidAssetAndRecipient(value) {
  return (
    isValidRequirementContainer(value) &&
    isNonZeroEthereumAddress(value.asset) &&
    isNonZeroEthereumAddress(value.payTo)
  );
}

function hasValidExtra(value) {
  return isValidRequirementContainer(value) && isValidExactEvmExtra(value.extra);
}

function requirementFingerprint(value) {
  if (
    !hasValidSchemeAndNetwork(value) ||
    !hasValidAmountAndTimeout(value) ||
    !hasValidAssetAndRecipient(value) ||
    !hasValidExtra(value)
  ) {
    return null;
  }
  return JSON.stringify([
    value.scheme,
    value.network,
    value.amount,
    value.asset.toLowerCase(),
    value.payTo.toLowerCase(),
    String(value.maxTimeoutSeconds),
    transferMethod(value.extra),
    value.extra.name,
    value.extra.version,
  ]);
}

function acceptsAreUnique(accepts) {
  const fingerprints = accepts.map(requirementFingerprint);
  return (
    fingerprints.every((fingerprint) => fingerprint !== null) &&
    new Set(fingerprints).size === fingerprints.length
  );
}

function hasUnmodeledContent(root) {
  if (!hasOnlyKeys(root, rootKeys)) {
    return true;
  }
  if (root.resource !== undefined && !hasOnlyKeys(root.resource, resourceKeys)) {
    return true;
  }
  if (Array.isArray(root.accepts)) {
    for (const requirement of root.accepts) {
      if (!hasOnlyKeys(requirement, requirementKeys)) {
        return true;
      }
      if (requirement.extra !== undefined && !hasOnlyKeys(requirement.extra, extraKeys)) {
        return true;
      }
    }
  }
  return root.extensions !== undefined &&
    (!isPlainRecord(root.extensions) || Object.keys(root.extensions).length > 0);
}

function normalizeLocator(locator) {
  const candidate = String(locator);
  if (candidate === "not-found" || candidate === "unmodeled-path") {
    return candidate;
  }
  return x402Locator.test(candidate) ? candidate.slice(0, 240) : "unmodeled-path";
}

function evidence(locator, signal) {
  return {
    documentName: "document-1",
    locator: normalizeLocator(locator),
    excerpt: `matched:${signal}`,
    untrustedEvidence: true,
  };
}

function statusFor({ present, valid, unmodeled }) {
  if (!present) {
    return "missing";
  }
  return valid && !unmodeled ? "clear" : "ambiguous";
}

const boundaryDefinitions = Object.freeze([
  {
    id: "XPR-001",
    boundary: "The document is an x402 v2 PaymentRequired envelope",
    locator: "/x402Version",
    ambiguousLocator: "/",
    signal: "x402-v2-envelope",
    correction: "Provide one decoded JSON PaymentRequired object with numeric x402Version 2.",
  },
  {
    id: "XPR-002",
    boundary: "Resource metadata is complete and bounded",
    locator: "/resource/url",
    ambiguousLocator: "/resource",
    signal: "bounded-resource-metadata",
    correction: "Provide a valid HTTP(S) resource URL and bounded optional ResourceInfo fields.",
  },
  {
    id: "XPR-003",
    boundary: "Accepted payment alternatives are non-empty, bounded, and unique",
    locator: "/accepts",
    signal: "bounded-unique-payment-alternatives",
    correction: `Under this Sentinel safety profile, provide between 1 and ${MAX_ACCEPTS} complete, non-duplicate PaymentRequirements objects.`,
  },
  {
    id: "XPR-004",
    boundary: "Every payment alternative uses exact on a canonical eip155 network",
    locator: "/accepts/0/network",
    ambiguousLocator: "/accepts",
    signal: "exact-eip155-profile",
    correction: "Use scheme exact and a canonical eip155:<decimal-chain-id> network, or treat the alternative as unsupported by this profile.",
  },
  {
    id: "XPR-005",
    boundary: "Atomic amount and completion timeout are positive and bounded",
    locator: "/accepts/0/amount",
    ambiguousLocator: "/accepts",
    signal: "positive-amount-and-timeout",
    correction: `Use a canonical positive uint256 decimal amount and maxTimeoutSeconds from 1 through ${MAX_TIMEOUT_SECONDS} under this Sentinel safety profile.`,
  },
  {
    id: "XPR-006",
    boundary: "Asset and recipient are non-zero EVM addresses",
    locator: "/accepts/0/payTo",
    ambiguousLocator: "/accepts",
    signal: "nonzero-evm-asset-recipient",
    correction: "Use non-zero 20-byte EVM addresses for asset and payTo in this exact-EVM profile.",
  },
  {
    id: "XPR-007",
    boundary: "Exact-EVM transfer metadata matches the EIP-3009 profile",
    locator: "/accepts/0/extra",
    ambiguousLocator: "/accepts",
    signal: "exact-evm-eip3009-metadata",
    correction: "Provide bounded EIP-712 name and version fields; assetTransferMethod must be absent or eip3009.",
  },
  {
    id: "XPR-008",
    boundary: "No unmodeled x402 fields or extensions are treated as verified",
    locator: "/extensions",
    ambiguousLocator: "unmodeled-path",
    signal: "closed-world-x402-content",
    correction: "Remove unknown fields or inspect extension and scheme-specific content under a separately pinned profile.",
  },
  {
    id: "XPR-009",
    boundary: "PaymentRequired does not prove payer policy, signature authorization, settlement, or receipt",
    locator: "/x402Version",
    signal: "payment-required-declaration-only",
    correction: "Evaluate payer policy, PaymentPayload authorization, facilitator verification and settlement, and receipt evidence separately.",
  },
]);

function finding(definition, status) {
  const risk =
    status === "clear"
      ? "Recognized x402 v2 structural declarations are present; implementation and on-chain behavior were not tested."
      : status === "ambiguous"
        ? definition.id === "XPR-009"
          ? "PaymentRequired declares payment terms but cannot establish payer authority or later payment evidence."
          : "The recognized declaration is invalid, unsupported by this exact-EVM profile, or accompanied by unmodeled content."
        : "The required x402 declaration was not found.";
  return {
    id: definition.id,
    boundary: definition.boundary,
    status,
    evidence: evidence(
      status === "missing"
        ? "not-found"
        : status === "ambiguous"
          ? (definition.ambiguousLocator ?? definition.locator)
          : definition.locator,
      status === "missing"
        ? "none"
        : status === "ambiguous" && definition.id !== "XPR-009"
          ? "invalid-or-unmodeled"
          : definition.signal,
    ),
    risk,
    correction: definition.correction,
  };
}

export function preflightX402V2PaymentRequired({ document }) {
  const prepared = preparePreflightDocuments([
    { ...document, mediaType: "application/json" },
  ]);
  const root = prepared.documents[0].parsed;
  if (!isPlainRecord(root)) {
    throw new PreflightInputError("Document 1 must contain a JSON object.");
  }
  const unmodeled = hasUnmodeledContent(root);
  const envelopePresent = isPlainRecord(root) && "x402Version" in root;
  const envelopeValid =
    envelopePresent &&
    root.x402Version === 2 &&
    (root.error === undefined || isBoundedString(root.error, 1_000));
  const resourcePresent = isPlainRecord(root) && "resource" in root;
  const acceptsPresent = isPlainRecord(root) && "accepts" in root;
  const acceptsValid =
    Array.isArray(root.accepts) &&
    root.accepts.length > 0 &&
    root.accepts.length <= MAX_ACCEPTS &&
    root.accepts.every(isValidRequirementContainer);
  const statuses = [
    statusFor({ present: envelopePresent, valid: envelopeValid, unmodeled }),
    statusFor({ present: resourcePresent, valid: isValidResource(root.resource), unmodeled }),
    statusFor({
      present: acceptsPresent,
      valid: acceptsValid && acceptsAreUnique(root.accepts),
      unmodeled,
    }),
    statusFor({
      present: acceptsPresent,
      valid: acceptsValid && root.accepts.every(hasValidSchemeAndNetwork),
      unmodeled,
    }),
    statusFor({
      present: acceptsPresent,
      valid: acceptsValid && root.accepts.every(hasValidAmountAndTimeout),
      unmodeled,
    }),
    statusFor({
      present: acceptsPresent,
      valid: acceptsValid && root.accepts.every(hasValidAssetAndRecipient),
      unmodeled,
    }),
    statusFor({
      present: acceptsPresent,
      valid: acceptsValid && root.accepts.every(hasValidExtra),
      unmodeled,
    }),
    statusFor({ present: true, valid: !unmodeled, unmodeled: false }),
    envelopeValid ? "ambiguous" : envelopePresent ? "ambiguous" : "missing",
  ];
  const findings = boundaryDefinitions.map((definition, index) =>
    finding(definition, statuses[index]),
  );
  const summary = { clear: 0, ambiguous: 0, missing: 0 };
  for (const item of findings) {
    summary[item.status] += 1;
  }

  return {
    schemaVersion: "1.0",
    kind: "x402-v2-payment-required-preflight",
    scope: {
      documentsAnalyzed: 1,
      combinedBytes: prepared.combinedBytes,
      deterministic: true,
      networkRequests: false,
      codeExecution: false,
      walletAccess: false,
      decodedJsonOnly: true,
      profile: "x402-v2-exact-evm-eip3009-sentinel-safe",
      specificationCommit: SPECIFICATION_COMMIT,
    },
    summary,
    findings,
    limitations: {
      paymentRequiredOnly: true,
      payerPolicyEvaluated: false,
      paymentPayloadVerified: false,
      signaturesVerified: false,
      settlementVerified: false,
      receiptVerified: false,
      networkExistenceVerified: false,
      assetContractBehaviorVerified: false,
      eip712DomainVerified: false,
      tokenOrRecipientOwnershipVerified: false,
      implementationTested: false,
    },
    escalation: {
      optional: true,
      serviceId: "agent-payment-boundary-review",
      priceUsd: 49,
      sampleUrl: `${SITE_BASE}sample-agent-payment-boundary-review.json`,
      quoteRequestContractUrl: `${SITE_BASE}service-request.json`,
      requestMovesFunds: false,
      requestAuthorizesPayment: false,
      completeWrittenQuoteRequired: true,
      payerMustFollowOwnPolicy: true,
    },
    disclaimer:
      "This closed-world Sentinel safety profile is intentionally stricter than core x402 and supports only exact EVM EIP-3009 declarations. A structurally clear x402 PaymentRequired document does not authorize payment. Payer policy must separately approve any payer-local signature, and this preflight does not verify PaymentPayload authorization, settlement, receipt, token ownership, recipient ownership, or implementation behavior.",
  };
}
