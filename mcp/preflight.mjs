export const MAX_PREFLIGHT_BYTES = 100 * 1024;

const MAX_JSON_DEPTH = 40;
const MAX_JSON_ENTRIES = 5_000;
const MAX_JSON_KEY_LENGTH = 80;
const MAX_LOCATOR_LENGTH = 240;
const SITE_BASE = "https://terminallylazy.github.io/sentinel-recovery-support/";
const encoder = new TextEncoder();
const ignoredSegment = /^(?:examples?|samples?|fixtures?|tests?|mocks?)$/i;
const quoteTupleFields = new Set([
  "quoteId",
  "serviceId",
  "priceUsd",
  "asset",
  "amountBaseUnits",
  "chainId",
  "recipient",
  "paymentReference",
  "issuedAt",
  "expiresAt",
  "deliverable",
  "turnaround",
  "cancellationAndRefundTerms",
]);
const requiredPaymentQuoteFields = new Set([
  "quoteId",
  "serviceId",
  "asset",
  "amountBaseUnits",
  "chainId",
  "recipient",
  "paymentReference",
  "expiresAt",
]);
const idempotencyFields = new Set([
  "quoteId",
  "paymentReference",
  "chainId",
  "recipient",
  "asset",
  "amountBaseUnits",
]);
const receiptReasonCodesByState = Object.freeze({
  pending: new Set([
    "unconfirmed",
    "transaction-not-observed",
    "confirmation-depth-not-met",
    "provider-timeout",
  ]),
  verified: new Set(["exact-tuple-confirmed", "exact-quote-tuple-confirmed"]),
  rejected: new Set([
    "wrong-tuple",
    "wrong-chain",
    "wrong-recipient",
    "unsupported-asset",
    "reverted-transaction",
  ]),
  "manual-review": new Set([
    "exception",
    "duplicate",
    "late",
    "partial",
    "overpayment",
    "reorg-or-conflicting-evidence",
  ]),
});
const receiptStateTerminal = Object.freeze({
  pending: false,
  verified: true,
  rejected: true,
  "manual-review": false,
});
const safeExceptionHandling = Object.freeze({
  duplicate: "do-not-credit-twice; manual-review",
  late: "do-not-start-work; manual-review",
  partial: "do-not-start-work; manual-review",
  overpayment: "do-not-expand-entitlement; manual-review",
});
const recognizedContainerLocator = /^(?:\/|\/(?:integrity|request|requestAuthorization|authorization|authorization\/autonomousPayment|authorization\/autonomousPayment\/allowedOnlyWhen|authorization\/autonomousPayment\/requiredPolicyBindings|safety|safety\/forbiddenInputs|network|recipient|supportedAssets|supportedAssets\/\d+|assets|assets\/\d+|quote|quote\/requiredFields|quote\/identifierRules|quote\/identifierRules\/(?:quoteId|paymentReference)|verification|reconciliation|reconciliation\/idempotencyTuple|reconciliation\/receiptIdentity|reconciliation\/receiptIdentity\/(?:nativeTuple|erc20Tuple)|reconciliation\/receiptStates|reconciliation\/receiptStates\/(?:pending|verified|rejected|manual-review)|reconciliation\/receiptStates\/(?:pending|verified|rejected|manual-review)\/reasonCodes|reconciliation\/exceptionHandling|warnings|payment|workflow|receiptAcceptance|downstreamFinancialAction|support|support\/assets|support\/receiptAcceptance|capabilities|capabilities\/\d+|capabilities\/\d+\/downstreamFinancialAction))$/i;
const recognizedLeafLocator = /^(?:\/(?:schemaVersion|version|status|publishedAt|canonicalUrl|sourceUrl|serviceCatalog|serviceRequestContract)|\/integrity\/(?:algorithm|representation|digestUrl|sourceHistoryUrl)|\/(?:request|requestAuthorization)\/(?:requestMovesFunds|requestAuthorizesPayment|completeQuoteRequiredBeforePayment)|\/authorization\/(?:requestMovesFunds|requestAuthorizesPayment|payerAgentMustFollowOwnPolicy|metadataExpandsPayerAuthority|recipientHumanAcceptanceRequired|inboundReceiptMayBeObservedAutomatically|outboundWalletActionRequiresHumanAuthorization|outboundUseOfFundsRequiresHumanAuthorization|recipientAgentMaySpend|recipientAgentMaySignOutboundTransaction|recipientAgentMayBroadcastOutboundTransaction)|\/authorization\/autonomousPayment\/metadataExpandsPayerAuthority|\/authorization\/autonomousPayment\/allowedOnlyWhen\/(?:completeWrittenQuotePresent|quoteNotExpired|payerPolicyApprovesExactQuote)|\/authorization\/autonomousPayment\/requiredPolicyBindings\/\d+|\/safety\/(?:takesCustody|requestsPrivateKeys|requestsSeedPhrases|requestsWalletSignatures|requestsWalletConnections|voluntarySupportCreatesServiceEntitlement)|\/safety\/forbiddenInputs\/\d+|\/network\/(?:name|chainId)|\/recipient\/(?:address|sourceUrl)|\/(?:supportedAssets|assets)\/\d+\/(?:symbol|kind|contractAddress)|\/quote\/issuerEmail|\/quote\/requiredFields\/\d+|\/quote\/identifierRules\/(?:quoteId|paymentReference)\/(?:format|unique|immutable|singleUse|boundToQuoteId)|\/verification\/rejectExpiredOrIncompleteQuote|\/reconciliation\/idempotencyTuple\/\d+|\/reconciliation\/receiptIdentity\/(?:nativeTuple|erc20Tuple)\/\d+|\/reconciliation\/receiptIdentity\/(?:uniqueAcrossQuotes|reuseHandling)|\/reconciliation\/receiptStates\/(?:pending|verified|rejected|manual-review)\/terminal|\/reconciliation\/receiptStates\/(?:pending|verified|rejected|manual-review)\/reasonCodes\/\d+|\/reconciliation\/exceptionHandling\/(?:duplicate|late|partial|overpayment)|\/warnings\/\d+|\/payment\/movesFunds|\/workflow\/completeQuoteRequiredBeforePayment|\/(?:receiptAcceptance|downstreamFinancialAction)\/(?:payerAgentMustFollowOwnPolicy|metadataExpandsPayerAuthority|recipientHumanAcceptanceRequired|inboundReceiptMayBeObservedAutomatically|mayBeObservedAutomatically|outboundWalletActionRequiresHumanAuthorization|outboundUseOfFundsRequiresHumanAuthorization)|\/support\/(?:walletAddress|chainId|network)|\/support\/assets\/\d+|\/support\/receiptAcceptance\/(?:recipientHumanAcceptanceRequired|inboundReceiptMayBeObservedAutomatically|mayBeObservedAutomatically|outboundWalletActionRequiresHumanAuthorization|outboundUseOfFundsRequiresHumanAuthorization)|\/capabilities\/\d+\/(?:id|requestMovesFunds|movesFunds|requestAuthorizesPayment|completeQuoteRequiredBeforePayment|payerAgentMustFollowOwnPolicy|metadataExpandsPayerAuthority|recipientHumanAcceptanceRequired|inboundReceiptMayBeObservedAutomatically|outboundWalletActionRequiresHumanAuthorization|outboundUseOfFundsRequiresHumanAuthorization|recipientAgentMaySpend|recipientAgentMaySignOutboundTransaction|recipientAgentMayBroadcastOutboundTransaction)|\/capabilities\/\d+\/downstreamFinancialAction\/(?:payerAgentMustFollowOwnPolicy|metadataExpandsPayerAuthority|recipientHumanAcceptanceRequired|recipientAgentMaySpend|recipientAgentMaySignOutboundTransaction|recipientAgentMayBroadcastOutboundTransaction))$/i;

export class PreflightInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "PreflightInputError";
  }
}

function escapePointer(segment) {
  return String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
}

function flattenJson(root, documentName) {
  const entries = [];
  const stack = [{ value: root, locator: "", depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current.depth > MAX_JSON_DEPTH) {
      throw new PreflightInputError(
        `Document exceeds the maximum JSON depth of ${MAX_JSON_DEPTH}.`,
      );
    }

    const locator = current.locator || "/";
    if (locator.length > MAX_LOCATOR_LENGTH) {
      throw new PreflightInputError(
        `Document JSON key or locator exceeds ${MAX_LOCATOR_LENGTH} characters.`,
      );
    }

    entries.push({ documentName, locator, value: current.value });
    if (entries.length > MAX_JSON_ENTRIES) {
      throw new PreflightInputError(
        `Document exceeds the maximum of ${MAX_JSON_ENTRIES} JSON entries.`,
      );
    }

    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({
          value: current.value[index],
          locator: `${current.locator}/${index}`,
          depth: current.depth + 1,
        });
      }
      continue;
    }

    if (current.value === null || typeof current.value !== "object") {
      continue;
    }

    const children = Object.entries(current.value);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const [key, value] = children[index];
      if (key.length > MAX_JSON_KEY_LENGTH) {
        throw new PreflightInputError(
          `Document JSON key or locator exceeds ${MAX_JSON_KEY_LENGTH} characters.`,
        );
      }
      if (ignoredSegment.test(key)) {
        continue;
      }
      stack.push({
        value,
        locator: `${current.locator}/${escapePointer(key)}`,
        depth: current.depth + 1,
      });
    }
  }

  return entries;
}

function assertNoDuplicateJsonKeys(content, documentNumber) {
  let index = 0;

  function skipWhitespace() {
    while (/\s/.test(content[index] ?? "")) {
      index += 1;
    }
  }

  function parseString() {
    const start = index;
    index += 1;
    while (index < content.length) {
      if (content[index] === "\\") {
        index += 2;
        continue;
      }
      if (content[index] === '"') {
        index += 1;
        return JSON.parse(content.slice(start, index));
      }
      index += 1;
    }
    return "";
  }

  function parsePrimitive() {
    while (
      index < content.length &&
      !/[\s,\]}]/.test(content[index])
    ) {
      index += 1;
    }
  }

  function assertDepth(depth) {
    if (depth > MAX_JSON_DEPTH + 1) {
      throw new PreflightInputError(
        `Document exceeds the maximum JSON depth of ${MAX_JSON_DEPTH}.`,
      );
    }
  }

  function parseValue(depth) {
    skipWhitespace();
    if (content[index] === "{") {
      parseObject(depth + 1);
      return;
    }
    if (content[index] === "[") {
      parseArray(depth + 1);
      return;
    }
    if (content[index] === '"') {
      parseString();
      return;
    }
    parsePrimitive();
  }

  function parseObject(depth) {
    assertDepth(depth);
    index += 1;
    skipWhitespace();
    const keys = new Set();
    if (content[index] === "}") {
      index += 1;
      return;
    }

    while (index < content.length) {
      skipWhitespace();
      const key = parseString();
      if (keys.has(key)) {
        throw new PreflightInputError(
          `Document ${documentNumber} contains duplicate JSON object keys.`,
        );
      }
      keys.add(key);
      skipWhitespace();
      index += 1;
      parseValue(depth);
      skipWhitespace();
      if (content[index] === "}") {
        index += 1;
        return;
      }
      index += 1;
    }
  }

  function parseArray(depth) {
    assertDepth(depth);
    index += 1;
    skipWhitespace();
    if (content[index] === "]") {
      index += 1;
      return;
    }

    while (index < content.length) {
      parseValue(depth);
      skipWhitespace();
      if (content[index] === "]") {
        index += 1;
        return;
      }
      index += 1;
    }
  }

  parseValue(0);
}

export function preparePreflightDocuments(documents) {
  const combinedBytes = documents.reduce(
    (total, document) => total + encoder.encode(document.content).byteLength,
    0,
  );

  if (combinedBytes > MAX_PREFLIGHT_BYTES) {
    throw new PreflightInputError(
      `The combined input exceeds ${MAX_PREFLIGHT_BYTES} bytes. Provide one or two smaller public documents.`,
    );
  }

  return {
    combinedBytes,
    documents: documents.map((document, index) => {
      const mediaType = document.mediaType ?? "text/plain";
      const documentName = `document-${index + 1}`;
      let parsed = null;
      let entries = [];

      if (mediaType === "application/json") {
        try {
          parsed = JSON.parse(document.content);
        } catch {
          throw new PreflightInputError(
            `Document ${index + 1} must contain valid JSON because its media type is application/json.`,
          );
        }

        assertNoDuplicateJsonKeys(document.content, index + 1);

        if (parsed === null || typeof parsed !== "object") {
          throw new PreflightInputError(
            `Document ${index + 1} must contain a JSON object or array.`,
          );
        }
        entries = flattenJson(parsed, documentName);
      }

      const textRecords =
        mediaType === "application/json"
          ? entries
              .filter(({ value }) => typeof value === "string")
              .map(({ locator, value }) => ({ documentName, locator, text: value }))
          : document.content.split(/\r?\n/).map((text, lineIndex) => ({
              documentName,
              locator: `line:${lineIndex + 1}`,
              text,
            }));

      return { documentName, mediaType, parsed, entries, textRecords };
    }),
  };
}

function normalizeEvidenceLocator(locator) {
  const candidate = String(locator);
  if (/^(?:line:\d+|not-found|unmodeled-path)$/.test(candidate)) {
    return candidate;
  }
  if (
    recognizedContainerLocator.test(candidate) ||
    recognizedLeafLocator.test(candidate)
  ) {
    return candidate.slice(0, MAX_LOCATOR_LENGTH);
  }
  return "unmodeled-path";
}

function evidence(documentName, locator, signal) {
  return {
    documentName,
    locator: normalizeEvidenceLocator(locator),
    excerpt: `matched:${signal}`,
    untrustedEvidence: true,
  };
}

function missingEvidence(documents) {
  return evidence(documents[0]?.documentName ?? "document-1", "not-found", "none");
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function findJson(documents, patterns, predicate, signal) {
  const matches = [];
  for (const document of documents) {
    for (const entry of document.entries) {
      if (matchesAny(entry.locator, patterns) && predicate(entry.value)) {
        matches.push(evidence(entry.documentName, entry.locator, signal));
      }
    }
  }
  return matches;
}

function findText(documents, patterns, signal) {
  const matches = [];
  for (const document of documents) {
    for (const record of document.textRecords) {
      if (matchesAny(record.text, patterns)) {
        matches.push(evidence(record.documentName, record.locator, signal));
      }
    }
  }
  return matches;
}

function isNonZeroEthereumAddress(value) {
  return (
    typeof value === "string" &&
    /^0x[0-9a-f]{40}$/i.test(value) &&
    !/^0x0{40}$/i.test(value)
  );
}

function isStrictMachineDataString(locator, text) {
  if (/^\/(?:canonicalUrl|sourceUrl|serviceCatalog|serviceRequestContract)$/i.test(locator)) {
    return /^(?:https?|sentinel):\/\/\S+$/i.test(text);
  }

  if (/^\/integrity\/(?:digestUrl|sourceHistoryUrl)$/i.test(locator)) {
    return /^https:\/\/\S+$/i.test(text);
  }

  if (/^\/recipient\/sourceUrl$/i.test(locator)) {
    return /^https:\/\/\S+$/i.test(text);
  }

  if (
    /^\/(?:recipient\/address|support\/walletAddress|(?:supportedAssets|assets)\/\d+\/contractAddress)$/i.test(
      locator,
    )
  ) {
    return isNonZeroEthereumAddress(text);
  }

  if (/^\/publishedAt$/i.test(locator)) {
    return (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(text) &&
      !Number.isNaN(Date.parse(text))
    );
  }

  if (/^\/(?:schemaVersion|version)$/i.test(locator)) {
    return /^\d+\.\d+(?:\.\d+)?$/.test(text);
  }

  if (/^\/status$/i.test(locator)) {
    return /^(?:active|draft|deprecated|inactive)$/i.test(text);
  }

  if (/^\/integrity\/algorithm$/i.test(locator)) {
    return /^sha256$/i.test(text);
  }

  if (/^\/integrity\/representation$/i.test(locator)) {
    return /^raw-file-bytes$/i.test(text);
  }

  if (/^\/network\/name$/i.test(locator)) {
    return /^ethereum-mainnet$/i.test(text);
  }

  if (/^\/(?:supportedAssets|assets)\/\d+\/symbol$/i.test(locator)) {
    return /^[A-Z0-9]{2,10}$/.test(text);
  }

  if (/^\/(?:supportedAssets|assets)\/\d+\/kind$/i.test(locator)) {
    return /^(?:native|erc20)$/i.test(text);
  }

  if (/^\/quote\/issuerEmail$/i.test(locator)) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  }

  if (/^\/quote\/requiredFields\/\d+$/i.test(locator)) {
    return quoteTupleFields.has(text);
  }

  if (/^\/quote\/identifierRules\/(?:quoteId|paymentReference)\/format$/i.test(locator)) {
    return text === "uuid-v4";
  }

  if (/^\/authorization\/autonomousPayment\/requiredPolicyBindings\/\d+$/i.test(locator)) {
    return quoteTupleFields.has(text);
  }

  if (/^\/reconciliation\/idempotencyTuple\/\d+$/i.test(locator)) {
    return idempotencyFields.has(text);
  }

  if (/^\/reconciliation\/receiptIdentity\/nativeTuple\/\d+$/i.test(locator)) {
    return ["chainId", "transactionHash"].includes(text);
  }

  if (/^\/reconciliation\/receiptIdentity\/erc20Tuple\/\d+$/i.test(locator)) {
    return ["chainId", "transactionHash", "logIndex"].includes(text);
  }

  if (/^\/reconciliation\/receiptIdentity\/reuseHandling$/i.test(locator)) {
    return text === "do-not-credit; manual-review";
  }

  const reasonCode = locator.match(
    /^\/reconciliation\/receiptStates\/(pending|verified|rejected|manual-review)\/reasonCodes\/\d+$/i,
  );
  if (reasonCode) {
    return receiptReasonCodesByState[reasonCode[1].toLowerCase()].has(text);
  }

  const exceptionMatch = locator.match(
    /^\/reconciliation\/exceptionHandling\/(duplicate|late|partial|overpayment)$/,
  );
  if (exceptionMatch) {
    return safeExceptionHandling[exceptionMatch[1]] === text;
  }

  if (/^\/warnings\/\d+$/i.test(locator)) {
    return text ===
      "Do not pay from the voluntary-support page for a paid service.";
  }

  if (/^\/safety\/forbiddenInputs\/\d+$/i.test(locator)) {
    return [
      "private keys",
      "seed phrases",
      "wallet signatures",
      "wallet connections",
    ].includes(text.toLowerCase());
  }

  if (/^\/support\/network$/i.test(locator)) {
    return text === "ethereum-mainnet";
  }

  if (/^\/support\/assets\/\d+$/i.test(locator)) {
    return ["ETH", "USDC", "USDT"].includes(text);
  }

  if (/^\/capabilities\/\d+\/id$/i.test(locator)) {
    return /^request_[a-z0-9_-]{1,80}$/i.test(text);
  }

  return false;
}

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactOrderedValues(value, expected) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function hasRequiredKnownValues(value, required, known) {
  return (
    Array.isArray(value) &&
    value.length === new Set(value).size &&
    value.every((item) => typeof item === "string" && known.has(item)) &&
    [...required].every((item) => value.includes(item))
  );
}

function isValidReceiptIdentity(value) {
  return (
    isPlainRecord(value) &&
    hasExactOrderedValues(value.nativeTuple, ["chainId", "transactionHash"]) &&
    hasExactOrderedValues(value.erc20Tuple, [
      "chainId",
      "transactionHash",
      "logIndex",
    ]) &&
    value.uniqueAcrossQuotes === true &&
    value.reuseHandling === "do-not-credit; manual-review"
  );
}

function isValidReceiptState(state, definition) {
  return (
    isPlainRecord(definition) &&
    definition.terminal === receiptStateTerminal[state] &&
    Array.isArray(definition.reasonCodes) &&
    definition.reasonCodes.length > 0 &&
    definition.reasonCodes.every(
      (reason) =>
        typeof reason === "string" &&
        receiptReasonCodesByState[state].has(reason),
    )
  );
}

function isValidReceiptStates(value) {
  return (
    isPlainRecord(value) &&
    Object.keys(receiptStateTerminal).every((state) =>
      isValidReceiptState(state, value[state]),
    )
  );
}

function isValidExceptionHandling(value) {
  return (
    isPlainRecord(value) &&
    Object.entries(safeExceptionHandling).every(
      ([key, expected]) => value[key] === expected,
    )
  );
}

function isValidRecognizedContainer(locator, value) {
  if (locator === "/") {
    return isPlainRecord(value);
  }

  if (/^\/(?:supportedAssets|assets|capabilities)$/i.test(locator)) {
    return Array.isArray(value) && value.length > 0;
  }

  if (/^\/(?:supportedAssets|assets)\/\d+$/i.test(locator)) {
    if (
      !isPlainRecord(value) ||
      typeof value.symbol !== "string" ||
      !/^[A-Z0-9]{2,10}$/.test(value.symbol)
    ) {
      return false;
    }
    if (value.kind === "native") {
      return value.symbol === "ETH" && value.contractAddress === null;
    }
    return (
      value.kind === "erc20" &&
      isNonZeroEthereumAddress(value.contractAddress)
    );
  }

  if (/^\/(?:warnings)$/i.test(locator)) {
    return Array.isArray(value);
  }

  if (/^\/support\/assets$/i.test(locator)) {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => ["ETH", "USDC", "USDT"].includes(item))
    );
  }

  if (/^\/safety\/forbiddenInputs$/i.test(locator)) {
    const required = [
      "private keys",
      "seed phrases",
      "wallet signatures",
      "wallet connections",
    ];
    return (
      Array.isArray(value) &&
      required.every((item) =>
        value.some(
          (candidate) =>
            typeof candidate === "string" &&
            candidate.toLowerCase().includes(item),
        ),
      )
    );
  }

  if (/^\/quote\/requiredFields$/i.test(locator)) {
    return hasRequiredKnownValues(
      value,
      requiredPaymentQuoteFields,
      quoteTupleFields,
    );
  }

  if (/^\/authorization\/autonomousPayment\/requiredPolicyBindings$/i.test(locator)) {
    return hasRequiredKnownValues(
      value,
      requiredPaymentQuoteFields,
      quoteTupleFields,
    );
  }

  if (/^\/reconciliation\/idempotencyTuple$/i.test(locator)) {
    return hasRequiredKnownValues(value, idempotencyFields, idempotencyFields);
  }

  if (/^\/reconciliation\/receiptIdentity\/nativeTuple$/i.test(locator)) {
    return hasExactOrderedValues(value, ["chainId", "transactionHash"]);
  }

  if (/^\/reconciliation\/receiptIdentity\/erc20Tuple$/i.test(locator)) {
    return hasExactOrderedValues(value, [
      "chainId",
      "transactionHash",
      "logIndex",
    ]);
  }

  if (/^\/reconciliation\/receiptIdentity$/i.test(locator)) {
    return isValidReceiptIdentity(value);
  }

  if (/^\/reconciliation\/receiptStates$/i.test(locator)) {
    return isValidReceiptStates(value);
  }

  const receiptState = locator.match(
    /^\/reconciliation\/receiptStates\/(pending|verified|rejected|manual-review)$/i,
  );
  if (receiptState) {
    return isValidReceiptState(receiptState[1].toLowerCase(), value);
  }

  const reasonCodes = locator.match(
    /^\/reconciliation\/receiptStates\/(pending|verified|rejected|manual-review)\/reasonCodes$/i,
  );
  if (reasonCodes) {
    const allowed = receiptReasonCodesByState[reasonCodes[1].toLowerCase()];
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (reason) => typeof reason === "string" && allowed.has(reason),
      )
    );
  }

  if (/^\/reconciliation\/exceptionHandling$/i.test(locator)) {
    return isValidExceptionHandling(value);
  }

  if (/^\/quote\/identifierRules\/quoteId$/i.test(locator)) {
    return (
      isPlainRecord(value) && value.unique === true && value.immutable === true
    );
  }

  if (/^\/quote\/identifierRules\/paymentReference$/i.test(locator)) {
    return (
      isPlainRecord(value) &&
      value.unique === true &&
      value.singleUse === true &&
      value.boundToQuoteId === true
    );
  }

  return isPlainRecord(value);
}

function isValidRecognizedLeaf(locator, value) {
  if (
    /^\/(?:supportedAssets|assets)\/\d+\/contractAddress$/i.test(locator) &&
    value === null
  ) {
    return true;
  }

  if (typeof value === "string") {
    return isStrictMachineDataString(locator, value.trim());
  }

  if (/\/(?:chainId)$/i.test(locator)) {
    return Number.isInteger(value) && value > 0;
  }

  if (typeof value !== "boolean") {
    return false;
  }

  const terminal = locator.match(
    /^\/reconciliation\/receiptStates\/(pending|verified|rejected|manual-review)\/terminal$/i,
  );
  if (terminal) {
    return value === receiptStateTerminal[terminal[1].toLowerCase()];
  }

  if (/^\/payment\/movesFunds$/i.test(locator)) {
    return value === true;
  }

  const field = locator.slice(locator.lastIndexOf("/") + 1);
  const expectedTrue = new Set([
    "completeQuoteRequiredBeforePayment",
    "payerAgentMustFollowOwnPolicy",
    "inboundReceiptMayBeObservedAutomatically",
    "mayBeObservedAutomatically",
    "outboundWalletActionRequiresHumanAuthorization",
    "outboundUseOfFundsRequiresHumanAuthorization",
    "completeWrittenQuotePresent",
    "quoteNotExpired",
    "payerPolicyApprovesExactQuote",
    "unique",
    "immutable",
    "singleUse",
    "boundToQuoteId",
    "rejectExpiredOrIncompleteQuote",
    "uniqueAcrossQuotes",
  ]);
  const expectedFalse = new Set([
    "requestMovesFunds",
    "movesFunds",
    "requestAuthorizesPayment",
    "metadataExpandsPayerAuthority",
    "recipientHumanAcceptanceRequired",
    "recipientAgentMaySpend",
    "recipientAgentMaySignOutboundTransaction",
    "recipientAgentMayBroadcastOutboundTransaction",
    "takesCustody",
    "requestsPrivateKeys",
    "requestsSeedPhrases",
    "requestsWalletSignatures",
    "requestsWalletConnections",
    "voluntarySupportCreatesServiceEntitlement",
  ]);

  if (expectedTrue.has(field)) {
    return value === true;
  }
  if (expectedFalse.has(field)) {
    return value === false;
  }
  return false;
}

function findUnmodeledDocumentContent(documents) {
  for (const document of documents) {
    if (document.mediaType !== "application/json") {
      const record = document.textRecords.find(({ text }) => text.trim().length > 0);
      return record
        ? [
            evidence(
              record.documentName,
              record.locator,
              "unmodeled-document-content",
            ),
          ]
        : [];
    }

    for (const entry of document.entries) {
      if (recognizedContainerLocator.test(entry.locator)) {
        if (!isValidRecognizedContainer(entry.locator, entry.value)) {
          return [
            evidence(
              entry.documentName,
              entry.locator,
              "invalid-modeled-content",
            ),
          ];
        }
        continue;
      }

      if (recognizedLeafLocator.test(entry.locator)) {
        if (!isValidRecognizedLeaf(entry.locator, entry.value)) {
          return [
            evidence(
              entry.documentName,
              entry.locator,
              "invalid-modeled-content",
            ),
          ];
        }
        continue;
      }

      return [
        evidence(
          entry.documentName,
          "unmodeled-path",
          "unmodeled-document-content",
        ),
      ];
    }

    for (const record of document.textRecords) {
      if (!isStrictMachineDataString(record.locator, record.text.trim())) {
        return [
          evidence(
            record.documentName,
            "unmodeled-path",
            "unmodeled-document-content",
          ),
        ];
      }
    }
  }
  return [];
}

function downgradeStructuredClearForProse(positive, negative, documents) {
  if (positive.length === 0) {
    return negative;
  }
  return [...negative, ...findUnmodeledDocumentContent(documents)];
}

function capabilityBoolean(documents, fields, expected, signal) {
  const matches = [];
  for (const document of documents) {
    for (const entry of document.entries) {
      if (!/^\/capabilities\/\d+$/.test(entry.locator)) {
        continue;
      }
      if (entry.value === null || typeof entry.value !== "object") {
        continue;
      }
      if (!/request/i.test(String(entry.value.id ?? ""))) {
        continue;
      }
      for (const field of fields) {
        if (entry.value[field] === expected) {
          matches.push(
            evidence(entry.documentName, `${entry.locator}/${field}`, signal),
          );
        }
      }
    }
  }
  return matches;
}

function assess({ positive = [], negative = [], partial = [] }, documents) {
  if (negative.length > 0) {
    return { status: "ambiguous", evidence: negative[0] };
  }
  if (positive.length > 0) {
    return { status: "clear", evidence: positive[0] };
  }
  if (partial.length > 0) {
    return { status: "ambiguous", evidence: partial[0] };
  }
  return { status: "missing", evidence: missingEvidence(documents) };
}

function requestBoundary(documents) {
  const movesFalse = [
    ...findJson(
      documents,
      [
        /^\/(?:request|requestAuthorization|authorization)\/requestMovesFunds$/i,
      ],
      (value) => value === false,
      "request-moves-no-funds",
    ),
    ...capabilityBoolean(
      documents,
      ["requestMovesFunds", "movesFunds"],
      false,
      "request-moves-no-funds",
    ),
  ];
  const authorizesFalse = [
    ...findJson(
      documents,
      [
        /^\/(?:request|requestAuthorization|authorization)\/requestAuthorizesPayment$/i,
      ],
      (value) => value === false,
      "request-authorizes-no-payment",
    ),
    ...capabilityBoolean(
      documents,
      ["requestAuthorizesPayment"],
      false,
      "request-authorizes-no-payment",
    ),
  ];
  const negative = [
    ...findJson(
      documents,
      [
        /^\/(?:request|requestAuthorization|authorization)\/requestMovesFunds$/i,
        /^\/(?:request|requestAuthorization|authorization)\/requestAuthorizesPayment$/i,
      ],
      (value) => value === true,
      "unsafe-request-financial-authority",
    ),
    ...capabilityBoolean(
      documents,
      ["requestMovesFunds", "movesFunds", "requestAuthorizesPayment"],
      true,
      "unsafe-request-financial-authority",
    ),
    ...findText(
      documents,
      [
        /requestMovesFunds\s*[:=]\s*true/i,
        /(?:quote|service) request\b.*(?:moves? funds|authorizes? payment)/i,
      ],
      "unsafe-request-financial-phrase",
    ),
  ];
  const prose = findText(
    documents,
    [
      /request\b.*(?:moves? no funds|does not move funds)\b.*(?:authorizes? no payment|does not authorize payment)/i,
    ],
    "request-non-financial-prose",
  );
  const positive =
    movesFalse.length > 0 && authorizesFalse.length > 0
      ? [movesFalse[0]]
      : [];
  return assess(
    {
      positive,
      negative: downgradeStructuredClearForProse(positive, negative, documents),
      partial: [...movesFalse, ...authorizesFalse, ...prose],
    },
    documents,
  );
}

function payerPolicyBoundary(documents) {
  const ownPolicy = findJson(
    documents,
    [
      /^\/(?:authorization|downstreamFinancialAction)\/payerAgentMustFollowOwnPolicy$/i,
      /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?payerAgentMustFollowOwnPolicy$/i,
    ],
    (value) => value === true,
    "payer-must-follow-own-policy",
  );
  const noExpansion = findJson(
    documents,
    [
      /^\/authorization(?:\/autonomousPayment)?\/metadataExpandsPayerAuthority$/i,
      /^\/downstreamFinancialAction\/metadataExpandsPayerAuthority$/i,
      /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?metadataExpandsPayerAuthority$/i,
    ],
    (value) => value === false,
    "metadata-expands-no-authority",
  );
  const negative = [
    ...findJson(
      documents,
      [
        /^\/(?:authorization|downstreamFinancialAction)\/payerAgentMustFollowOwnPolicy$/i,
        /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?payerAgentMustFollowOwnPolicy$/i,
      ],
      (value) => value === false,
      "unsafe-payer-policy-field",
    ),
    ...findJson(
      documents,
      [
        /^\/authorization(?:\/autonomousPayment)?\/metadataExpandsPayerAuthority$/i,
        /^\/downstreamFinancialAction\/metadataExpandsPayerAuthority$/i,
        /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?metadataExpandsPayerAuthority$/i,
      ],
      (value) => value === true,
      "unsafe-authority-expansion-field",
    ),
    ...findText(
      documents,
      [/payer policy (?:is )?not required/i, /metadata\b.*expands?\b.*authority/i],
      "unsafe-payer-policy-phrase",
    ),
  ];
  const prose = findText(
    documents,
    [/payer(?: agent)?\b.*(?:own|delegated)\b.*policy/i],
    "payer-policy-prose",
  );
  const positive =
    ownPolicy.length > 0 && noExpansion.length > 0 ? [ownPolicy[0]] : [];
  return assess(
    {
      positive,
      negative: downgradeStructuredClearForProse(positive, negative, documents),
      partial: [...ownPolicy, ...noExpansion, ...prose],
    },
    documents,
  );
}

function receiptDirectionBoundary(documents) {
  const inbound = [
    ...findJson(
      documents,
      [
        /^\/(?:authorization|receiptAcceptance|downstreamFinancialAction)\/recipientHumanAcceptanceRequired$/i,
        /^\/support\/receiptAcceptance\/recipientHumanAcceptanceRequired$/i,
        /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?recipientHumanAcceptanceRequired$/i,
      ],
      (value) => value === false,
      "inbound-needs-no-recipient-acceptance",
    ),
    ...findJson(
      documents,
      [
        /^\/(?:authorization|receiptAcceptance)\/inboundReceiptMayBeObservedAutomatically$/i,
        /^\/support\/receiptAcceptance\/(?:inboundReceiptMayBeObservedAutomatically|mayBeObservedAutomatically)$/i,
        /^\/capabilities\/\d+\/inboundReceiptMayBeObservedAutomatically$/i,
      ],
      (value) => value === true,
      "inbound-may-be-observed-automatically",
    ),
  ];
  const outbound = findJson(
    documents,
    [
      /^\/(?:authorization|receiptAcceptance)\/(?:outboundWalletAction|outboundUseOfFunds)RequiresHumanAuthorization$/i,
      /^\/support\/receiptAcceptance\/(?:outboundWalletAction|outboundUseOfFunds)RequiresHumanAuthorization$/i,
      /^\/capabilities\/\d+\/(?:outboundWalletAction|outboundUseOfFunds)RequiresHumanAuthorization$/i,
    ],
    (value) => value === true,
    "outbound-requires-human-authorization",
  );
  const negative = [
    ...findJson(
      documents,
      [
        /^\/(?:authorization|receiptAcceptance|downstreamFinancialAction)\/recipientHumanAcceptanceRequired$/i,
        /^\/support\/receiptAcceptance\/recipientHumanAcceptanceRequired$/i,
        /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?recipientHumanAcceptanceRequired$/i,
      ],
      (value) => value === true,
      "unsafe-inbound-acceptance-field",
    ),
    ...findJson(
      documents,
      [
        /^\/(?:authorization|receiptAcceptance)\/(?:outboundWalletAction|outboundUseOfFunds)RequiresHumanAuthorization$/i,
        /^\/support\/receiptAcceptance\/(?:outboundWalletAction|outboundUseOfFunds)RequiresHumanAuthorization$/i,
        /^\/capabilities\/\d+\/(?:outboundWalletAction|outboundUseOfFunds)RequiresHumanAuthorization$/i,
      ],
      (value) => value === false,
      "unsafe-outbound-authorization-field",
    ),
  ];
  const positive =
    inbound.length > 0 && outbound.length > 0 ? [inbound[0]] : [];
  return assess(
    {
      positive,
      negative: downgradeStructuredClearForProse(positive, negative, documents),
      partial: [...inbound, ...outbound],
    },
    documents,
  );
}

function recipientAuthorityBoundary(documents) {
  const spend = findJson(
    documents,
    [
      /^\/authorization\/recipientAgentMaySpend$/i,
      /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?recipientAgentMaySpend$/i,
    ],
    (value) => value === false,
    "recipient-agent-cannot-spend",
  );
  const sign = findJson(
    documents,
    [
      /^\/authorization\/recipientAgentMaySignOutboundTransaction$/i,
      /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?recipientAgentMaySignOutboundTransaction$/i,
    ],
    (value) => value === false,
    "recipient-agent-cannot-sign",
  );
  const broadcast = findJson(
    documents,
    [
      /^\/authorization\/recipientAgentMayBroadcastOutboundTransaction$/i,
      /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?recipientAgentMayBroadcastOutboundTransaction$/i,
    ],
    (value) => value === false,
    "recipient-agent-cannot-broadcast",
  );
  const custody = findJson(
    documents,
    [/^\/safety\/takesCustody$/i],
    (value) => value === false,
    "service-takes-no-custody",
  );
  const negative = [
    ...findJson(
      documents,
      [
        /^\/authorization\/recipientAgentMay(?:Spend|SignOutboundTransaction|BroadcastOutboundTransaction)$/i,
        /^\/capabilities\/\d+\/(?:downstreamFinancialAction\/)?recipientAgentMay(?:Spend|SignOutboundTransaction|BroadcastOutboundTransaction)$/i,
        /^\/safety\/takesCustody$/i,
      ],
      (value) => value === true,
      "unsafe-recipient-wallet-authority",
    ),
    ...findText(
      documents,
      [
        /recipient agents? may (?:spend|sign|broadcast)/i,
        /(?:grant|allow)\b.*recipient agent\b.*wallet (?:control|authority)/i,
      ],
      "unsafe-recipient-authority-phrase",
    ),
  ];
  const positive =
    spend.length > 0 &&
    sign.length > 0 &&
    broadcast.length > 0 &&
    custody.length > 0
      ? [spend[0]]
      : [];
  return assess(
    {
      positive,
      negative: downgradeStructuredClearForProse(positive, negative, documents),
      partial: [...spend, ...sign, ...broadcast, ...custody],
    },
    documents,
  );
}

function canonicalTupleBoundary(documents) {
  const tuples = documents.map((document) => {
    const chainEntries = document.entries.filter(
      ({ locator, value }) =>
        /^\/(?:network\/chainId|chainId|support\/chainId)$/i.test(locator) &&
        Number.isInteger(value) &&
        value > 0,
    );
    const recipientEntries = document.entries.filter(
      ({ locator, value }) =>
        /^\/(?:recipient\/address|support\/walletAddress)$/i.test(locator) &&
        isNonZeroEthereumAddress(value),
    );
    const assetEntries = document.entries.filter(({ locator, value }) => {
      return (
        /^\/(?:supportedAssets|assets)\/\d+$/i.test(locator) &&
        value !== null &&
        typeof value === "object" &&
        typeof value.symbol === "string" &&
        /^[A-Z0-9]{2,10}$/.test(value.symbol) &&
        value.kind === "erc20" &&
        isNonZeroEthereumAddress(value.contractAddress)
      );
    });

    return {
      document,
      chainEntries,
      recipientEntries,
      assetEntries,
      chains: new Set(chainEntries.map(({ value }) => value)),
      recipients: new Set(
        recipientEntries.map(({ value }) => value.toLowerCase()),
      ),
    };
  });

  const chainEntries = tuples.flatMap(({ chainEntries }) => chainEntries);
  const recipientEntries = tuples.flatMap(
    ({ recipientEntries }) => recipientEntries,
  );
  const assetEntries = tuples.flatMap(({ assetEntries }) => assetEntries);
  const declaredAssetEntries = documents.flatMap((document) =>
    document.entries.filter(
      ({ locator, value }) =>
        /^\/support\/assets\/\d+$/i.test(locator) &&
        typeof value === "string" &&
        ["ETH", "USDC", "USDT"].includes(value),
    ),
  );
  const conflicts = [];

  if (new Set(chainEntries.map(({ value }) => value)).size > 1) {
    const entry = chainEntries.at(-1);
    conflicts.push(
      evidence(entry.documentName, entry.locator, "conflicting-canonical-chain"),
    );
  }

  if (
    new Set(recipientEntries.map(({ value }) => value.toLowerCase())).size > 1
  ) {
    const entry = recipientEntries.at(-1);
    conflicts.push(
      evidence(
        entry.documentName,
        entry.locator,
        "conflicting-canonical-recipient",
      ),
    );
  }

  const contractsBySymbol = new Map();
  for (const entry of assetEntries) {
    const symbol = entry.value.symbol.toUpperCase();
    if (!contractsBySymbol.has(symbol)) {
      contractsBySymbol.set(symbol, new Set());
    }
    contractsBySymbol.get(symbol).add(entry.value.contractAddress.toLowerCase());
  }
  for (const [symbol, contracts] of contractsBySymbol) {
    if (contracts.size > 1) {
      const entry = assetEntries.find(
        ({ value }) =>
          value.symbol.toUpperCase() === symbol &&
          contracts.has(value.contractAddress.toLowerCase()) &&
          value.contractAddress.toLowerCase() !== [...contracts][0],
      );
      conflicts.push(
        evidence(
          entry.documentName,
          `${entry.locator}/contractAddress`,
          "conflicting-canonical-asset-contract",
        ),
      );
      break;
    }
  }

  const missingContract = declaredAssetEntries.find(
    ({ value }) => value !== "ETH" && !contractsBySymbol.has(value),
  );
  if (missingContract) {
    conflicts.push(
      evidence(
        missingContract.documentName,
        missingContract.locator,
        "declared-asset-missing-canonical-contract",
      ),
    );
  }

  const complete = tuples.find(
    ({ chains, recipients, assetEntries: entries }) =>
      chains.size === 1 && recipients.size === 1 && entries.length > 0,
  );
  const positive =
    complete && conflicts.length === 0
      ? [
          evidence(
            complete.document.documentName,
            complete.recipientEntries[0].locator,
            "consistent-canonical-payment-tuple",
          ),
        ]
      : [];
  const partial = [
    ...chainEntries.map((entry) =>
      evidence(entry.documentName, entry.locator, "canonical-chain-id"),
    ),
    ...recipientEntries.map((entry) =>
      evidence(entry.documentName, entry.locator, "canonical-recipient-address"),
    ),
    ...assetEntries.map((entry) =>
      evidence(
        entry.documentName,
        `${entry.locator}/contractAddress`,
        "canonical-asset-contract",
      ),
    ),
  ];
  return assess(
    {
      positive,
      negative: downgradeStructuredClearForProse(positive, conflicts, documents),
      partial,
    },
    documents,
  );
}

function quoteBoundary(documents) {
  const quoteFirst = [
    ...findJson(
      documents,
      [
        /^\/(?:request|workflow)\/completeQuoteRequiredBeforePayment$/i,
      ],
      (value) => value === true,
      "complete-quote-required-before-payment",
    ),
    ...capabilityBoolean(
      documents,
      ["completeQuoteRequiredBeforePayment"],
      true,
      "complete-quote-required-before-payment",
    ),
  ];
  const requiredTuple = findJson(
    documents,
    [/^\/quote\/requiredFields$/i],
    (value) =>
      Array.isArray(value) &&
      [
        "quoteId",
        "serviceId",
        "asset",
        "amountBaseUnits",
        "chainId",
        "recipient",
        "paymentReference",
        "expiresAt",
      ].every((field) => value.includes(field)),
    "complete-quote-tuple",
  );
  const expiryEnforced = findJson(
    documents,
    [/^\/verification\/rejectExpiredOrIncompleteQuote$/i],
    (value) => value === true,
    "expired-or-incomplete-quote-rejected",
  );
  const negative = [
    ...findJson(
      documents,
      [/^\/(?:request|workflow)\/completeQuoteRequiredBeforePayment$/i],
      (value) => value === false,
      "unsafe-quote-first-field",
    ),
    ...findText(
      documents,
      [/pay(?:ment)?\b.*before\b.*(?:complete )?quote/i],
      "unsafe-pay-before-quote-phrase",
    ),
  ];
  const prose = findText(
    documents,
    [/complete written quote\b.*before\b.*payment/i],
    "quote-first-prose",
  );
  const positive =
    quoteFirst.length > 0 &&
    requiredTuple.length > 0 &&
    expiryEnforced.length > 0
      ? [quoteFirst[0]]
      : [];
  return assess(
    {
      positive,
      negative: downgradeStructuredClearForProse(positive, negative, documents),
      partial: [...quoteFirst, ...requiredTuple, ...expiryEnforced, ...prose],
    },
    documents,
  );
}

function replayBoundary(documents) {
  const quoteRules = findJson(
    documents,
    [/^\/quote\/identifierRules\/quoteId$/i],
    (value) =>
      value !== null &&
      typeof value === "object" &&
      value.unique === true &&
      value.immutable === true,
    "quote-id-unique-and-immutable",
  );
  const paymentRules = findJson(
    documents,
    [/^\/quote\/identifierRules\/paymentReference$/i],
    (value) =>
      value !== null &&
      typeof value === "object" &&
      value.unique === true &&
      value.singleUse === true &&
      value.boundToQuoteId === true,
    "payment-reference-single-use",
  );
  const idempotency = findJson(
    documents,
    [/^\/reconciliation\/idempotencyTuple$/i],
    (value) =>
      Array.isArray(value) &&
      [
        "quoteId",
        "paymentReference",
        "chainId",
        "recipient",
        "asset",
        "amountBaseUnits",
      ].every((field) => value.includes(field)),
    "complete-idempotency-tuple",
  );
  const receiptIdentity = findJson(
    documents,
    [/^\/reconciliation\/receiptIdentity$/i],
    (value) =>
      value !== null &&
      typeof value === "object" &&
      Array.isArray(value.nativeTuple) &&
      value.nativeTuple.length === 2 &&
      value.nativeTuple[0] === "chainId" &&
      value.nativeTuple[1] === "transactionHash" &&
      Array.isArray(value.erc20Tuple) &&
      value.erc20Tuple.length === 3 &&
      value.erc20Tuple[0] === "chainId" &&
      value.erc20Tuple[1] === "transactionHash" &&
      value.erc20Tuple[2] === "logIndex" &&
      value.uniqueAcrossQuotes === true &&
      value.reuseHandling === "do-not-credit; manual-review",
    "unique-on-chain-receipt-identity",
  );
  const exceptions = findJson(
    documents,
    [/^\/reconciliation\/exceptionHandling$/i],
    (value) => {
      if (value === null || typeof value !== "object") {
        return false;
      }
      const rules = {
        duplicate: "do-not-credit-twice; manual-review",
        late: "do-not-start-work; manual-review",
        partial: "do-not-start-work; manual-review",
        overpayment: "do-not-expand-entitlement; manual-review",
      };
      return Object.entries(rules).every(
        ([key, expected]) => value[key] === expected,
      );
    },
    "safe-payment-exception-handling",
  );
  const positive =
    quoteRules.length > 0 &&
    paymentRules.length > 0 &&
    idempotency.length > 0 &&
    receiptIdentity.length > 0 &&
    exceptions.length > 0
      ? [idempotency[0]]
      : [];
  return assess(
    {
      positive,
      negative: downgradeStructuredClearForProse(positive, [], documents),
      partial: [
        ...quoteRules,
        ...paymentRules,
        ...idempotency,
        ...receiptIdentity,
        ...exceptions,
      ],
    },
    documents,
  );
}

function receiptStatesBoundary(documents) {
  const states = findJson(
    documents,
    [/^\/reconciliation\/receiptStates$/i],
    isValidReceiptStates,
    "deterministic-receipt-states",
  );
  const partial = findJson(
    documents,
    [/^\/reconciliation\/receiptStates$/i],
    (value) => value !== null && typeof value === "object",
    "incomplete-receipt-states",
  );
  return assess(
    {
      positive: states,
      negative: downgradeStructuredClearForProse(states, [], documents),
      partial,
    },
    documents,
  );
}

function forbiddenSecretsBoundary(documents) {
  const privateKeys = findJson(
    documents,
    [/^\/safety\/requestsPrivateKeys$/i],
    (value) => value === false,
    "private-keys-prohibited",
  );
  const seeds = findJson(
    documents,
    [/^\/safety\/requestsSeedPhrases$/i],
    (value) => value === false,
    "seed-phrases-prohibited",
  );
  const signatures = findJson(
    documents,
    [/^\/safety\/requestsWalletSignatures$/i],
    (value) => value === false,
    "wallet-signatures-prohibited",
  );
  const connections = findJson(
    documents,
    [/^\/safety\/requestsWalletConnections$/i],
    (value) => value === false,
    "wallet-connections-prohibited",
  );
  const forbiddenList = findJson(
    documents,
    [/^\/safety\/forbiddenInputs$/i],
    (value) =>
      Array.isArray(value) &&
      ["private keys", "seed phrases", "wallet signatures", "wallet connections"].every(
        (required) =>
          value.some(
            (item) =>
              typeof item === "string" &&
              item.toLowerCase().includes(required),
          ),
      ),
    "sensitive-wallet-inputs-prohibited",
  );
  const negative = [
    ...findJson(
      documents,
      [
        /^\/safety\/requests(?:PrivateKeys|SeedPhrases|WalletSignatures|WalletConnections)$/i,
      ],
      (value) => value === true,
      "unsafe-sensitive-wallet-input-field",
    ),
    ...findText(
      documents,
      [
        /request (?:private keys?|seed phrases?|wallet signatures?)/i,
        /(?:wallet connection|connect (?:a |your )?wallet) (?:is )?required/i,
      ],
      "unsafe-sensitive-wallet-input-phrase",
    ),
  ];
  const prose = findText(
    documents,
    [/never (?:provide|request).*(?:private keys?|seed phrases?).*(?:signatures?|wallet connections?)/i],
    "sensitive-wallet-input-prohibition-prose",
  );
  const booleansComplete =
    privateKeys.length > 0 &&
    seeds.length > 0 &&
    signatures.length > 0 &&
    connections.length > 0;
  const positive = booleansComplete
    ? [privateKeys[0]]
    : forbiddenList.length > 0
      ? [forbiddenList[0]]
      : [];
  return assess(
    {
      positive,
      negative: downgradeStructuredClearForProse(positive, negative, documents),
      partial: [
        ...privateKeys,
        ...seeds,
        ...signatures,
        ...connections,
        ...forbiddenList,
        ...prose,
      ],
    },
    documents,
  );
}

function donationBoundary(documents) {
  const noEntitlement = findJson(
    documents,
    [/^\/safety\/voluntarySupportCreatesServiceEntitlement$/i],
    (value) => value === false,
    "voluntary-support-creates-no-entitlement",
  );
  const separation = findText(
    documents,
    [/do not pay from the voluntary-support page for a paid service/i],
    "donation-separated-from-service-payment",
  );
  const negative = findJson(
    documents,
    [/^\/safety\/voluntarySupportCreatesServiceEntitlement$/i],
    (value) => value === true,
    "unsafe-voluntary-support-entitlement",
  );
  const positive =
    noEntitlement.length > 0 && separation.length > 0
      ? [noEntitlement[0]]
      : [];
  return assess(
    {
      positive,
      negative: downgradeStructuredClearForProse(positive, negative, documents),
      partial: [...noEntitlement, ...separation],
    },
    documents,
  );
}

function integrityBoundary(documents) {
  const published = findJson(
    documents,
    [/^\/publishedAt$/i],
    (value) =>
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
      !Number.isNaN(Date.parse(value)),
    "publication-time-present",
  );
  const digestReference = findJson(
    documents,
    [/^\/integrity$/i],
    (value) =>
      value !== null &&
      typeof value === "object" &&
      String(value.algorithm).toLowerCase() === "sha256" &&
      typeof value.digestUrl === "string" &&
      /^https:\/\//i.test(value.digestUrl),
    "external-sha256-reference-unverified",
  );
  return assess(
    {
      partial: [...published, ...digestReference],
    },
    documents,
  );
}

const BOUNDARIES = Object.freeze([
  {
    id: "APB-001",
    boundary: "A quote request does not move funds or authorize payment",
    evaluate: requestBoundary,
    ambiguousRisk: "The request surface contains incomplete or contradictory financial authority signals.",
    missingRisk: "The documents do not explicitly separate a quote request from payment authority.",
    correction: "State separately that a request moves no funds and authorizes no payment.",
  },
  {
    id: "APB-002",
    boundary: "Payer authority remains constrained by the payer's own policy",
    evaluate: payerPolicyBoundary,
    ambiguousRisk: "The documents may be read as expanding an agent's payment authority.",
    missingRisk: "No explicit payer-policy boundary was found.",
    correction: "Require the payer's own delegated policy to approve the exact payment tuple and say metadata expands no authority.",
  },
  {
    id: "APB-003",
    boundary: "Inbound receipt acceptance is distinct from outbound wallet authority",
    evaluate: receiptDirectionBoundary,
    ambiguousRisk: "Inbound acceptance and outbound use are not consistently direction-specific.",
    missingRisk: "The recipient-side inbound and outbound authority rules are not both explicit.",
    correction: "State that inbound receipts need no recipient acceptance while every outbound wallet action requires human authorization.",
  },
  {
    id: "APB-004",
    boundary: "Recipient agents cannot spend, sign, broadcast, or take custody",
    evaluate: recipientAuthorityBoundary,
    ambiguousRisk: "One or more recipient-agent wallet capabilities are allowed or left unclear.",
    missingRisk: "Recipient-agent spending, signing, broadcasting, and custody are not all addressed.",
    correction: "Deny recipient-agent spend, sign, broadcast, and custody capabilities explicitly.",
  },
  {
    id: "APB-005",
    boundary: "Chain, recipient, and asset contract form a canonical payment tuple",
    evaluate: canonicalTupleBoundary,
    ambiguousRisk: "Only part of the canonical payment tuple is machine-readable.",
    missingRisk: "No complete canonical chain, recipient, and token-contract tuple was found.",
    correction: "Publish and independently verify chain ID, recipient, and each supported asset contract.",
  },
  {
    id: "APB-006",
    boundary: "Payment requires a complete unexpired written quote",
    evaluate: quoteBoundary,
    ambiguousRisk: "Quote-first language, the exact tuple, or expiry enforcement is incomplete.",
    missingRisk: "The documents do not require a complete unexpired quote before payment.",
    correction: "Require an enforced expiring quote that binds service, asset, amount, chain, recipient, and payment reference.",
  },
  {
    id: "APB-007",
    boundary: "Quote, payment, and receipt identifiers are replay-resistant and idempotent",
    evaluate: replayBoundary,
    ambiguousRisk: "Identifier, tuple, or exception rules exist but do not safely cover replay and duplicate handling.",
    missingRisk: "No one-use identifier and reconciliation rules were found.",
    correction: "Define unique immutable quote IDs, single-use payment references, a complete idempotency tuple, a unique on-chain receipt identity across quotes, and deny automatic exception handling.",
  },
  {
    id: "APB-008",
    boundary: "Receipt verification has deterministic states",
    evaluate: receiptStatesBoundary,
    ambiguousRisk: "The receipt state model lacks terminal flags or non-empty reason codes.",
    missingRisk: "Pending, verified, rejected, and manual-review states were not found.",
    correction: "Publish deterministic receipt states and reason codes for timeout, reorg, wrong tuple, partial, and excess payments.",
  },
  {
    id: "APB-009",
    boundary: "Keys, seed phrases, signatures, and wallet connections are prohibited",
    evaluate: forbiddenSecretsBoundary,
    ambiguousRisk: "At least one sensitive wallet input appears permitted, contradicted, or only partially prohibited.",
    missingRisk: "The documents do not prohibit all sensitive wallet inputs.",
    correction: "Explicitly prohibit private keys, seed phrases, wallet signatures, and wallet connections.",
  },
  {
    id: "APB-010",
    boundary: "Voluntary support is separate from paid-service entitlement",
    evaluate: donationBoundary,
    ambiguousRisk: "Donation and service-payment semantics are not fully separated.",
    missingRisk: "No explicit donation-versus-entitlement separation was found.",
    correction: "State that voluntary support creates no entitlement and must not be used to pay for a quoted service.",
  },
  {
    id: "APB-011",
    boundary: "Payment metadata publishes freshness and integrity evidence",
    evaluate: integrityBoundary,
    ambiguousRisk: "A timestamp or external digest reference exists, but the supplied content cannot be verified locally.",
    missingRisk: "No publication timestamp and verifiable content digest were found.",
    correction: "Publish an update time and a locally verifiable canonical SHA-256 digest or provide the digest document for independent review.",
  },
]);

function findingFor(boundary, documents) {
  const assessment = boundary.evaluate(documents);
  const risk =
    assessment.status === "clear"
      ? "Recognized structured declarations are present and no unmodeled supplied content was observed; implementation behavior was not tested."
      : assessment.status === "ambiguous"
        ? boundary.ambiguousRisk
        : boundary.missingRisk;
  return {
    id: boundary.id,
    boundary: boundary.boundary,
    status: assessment.status,
    evidence: assessment.evidence,
    risk,
    correction: boundary.correction,
  };
}

export function preflightAgentPaymentBoundary({ documents }) {
  const prepared = preparePreflightDocuments(documents);
  const findings = BOUNDARIES.map((boundary) =>
    findingFor(boundary, prepared.documents),
  );
  const summary = { clear: 0, ambiguous: 0, missing: 0 };
  for (const finding of findings) {
    summary[finding.status] += 1;
  }

  return {
    schemaVersion: "1.0",
    kind: "agent-payment-boundary-preflight",
    scope: {
      documentsAnalyzed: prepared.documents.length,
      combinedBytes: prepared.combinedBytes,
      deterministic: true,
      networkRequests: false,
      codeExecution: false,
      walletAccess: false,
    },
    summary,
    findings,
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
      "This deterministic public-document preflight is not a security certification, not a legal opinion, not a wallet audit, and not a guarantee that an agent or payment implementation is safe.",
  };
}
