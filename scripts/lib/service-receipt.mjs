import { canonicalJsonDigest } from "./service-quote.mjs";

const TRANSACTION_HASH = /^0x[0-9a-f]{64}$/i;
const ADDRESS = /^0x[0-9a-f]{40}$/i;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const normalizeAddress = (value) => value?.toLowerCase();
const parseQuantity = (value, name) => {
  if (!/^0x[0-9a-f]+$/i.test(value ?? "")) {
    throw new Error(`${name} is not a valid JSON-RPC quantity`);
  }
  return BigInt(value);
};

function receiptResult(quote, values) {
  return {
    schemaVersion: "1.0",
    kind: "sentinel-service-receipt-check",
    quoteId: quote.quoteId,
    paymentReference: quote.paymentReference,
    movesFunds: false,
    requestsWalletAccess: false,
    payerIdentityVerified: false,
    payerAuthorityVerified: false,
    paymentIntentProven: false,
    ...values,
  };
}

function validateQuote(quote, paymentContract, services) {
  if (quote?.kind !== "sentinel-service-quote" || quote.complete !== true) {
    throw new Error("quote is not a complete Sentinel service quote");
  }
  if (
    quote.demonstration !== false ||
    quote.payable !== true ||
    quote.approvalState !== "approved"
  ) {
    throw new Error("quote is not an approved payable non-demonstration quote");
  }
  if (
    quote.issuance?.humanApproved !== true ||
    !["email", "github-issue"].includes(quote.issuance.channel) ||
    quote.issuance.issuerEmail !== paymentContract.quote.issuerEmail ||
    quote.issuance.deliveryRequiredThroughSelectedReplyChannel !== true ||
    quote.issuance.payerMustVerifySentinelControlledReplySource !== true ||
    quote.issuance.standaloneCryptographicSignaturePresent !== false
  ) {
    throw new Error("quote issuance boundary is invalid");
  }
  for (const field of paymentContract.quote.requiredFields) {
    if (!(field in quote) || quote[field] === null || quote[field] === "") {
      throw new Error(`quote is missing required field ${field}`);
    }
  }
  if (
    !UUID_V4.test(quote.quoteId ?? "") ||
    !UUID_V4.test(quote.paymentReference ?? "") ||
    quote.quoteId.toLowerCase() === quote.paymentReference.toLowerCase()
  ) {
    throw new Error("quote identifiers must be distinct UUID v4 values");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(quote.requestFingerprint ?? "")) {
    throw new Error("quote requestFingerprint is invalid");
  }
  const serviceSnapshot = quote.contractSnapshots?.services;
  const paymentSnapshot = quote.contractSnapshots?.servicePayment;
  if (
    serviceSnapshot?.canonicalUrl !== paymentContract.serviceCatalog ||
    paymentSnapshot?.canonicalUrl !== paymentContract.canonicalUrl ||
    !/^[0-9a-f]{64}$/.test(serviceSnapshot?.canonicalJsonSha256 ?? "") ||
    !/^[0-9a-f]{64}$/.test(paymentSnapshot?.canonicalJsonSha256 ?? "")
  ) {
    throw new Error("quote contractSnapshots are invalid");
  }
  if (
    serviceSnapshot.canonicalJsonSha256 !== canonicalJsonDigest(services) ||
    paymentSnapshot.canonicalJsonSha256 !== canonicalJsonDigest(paymentContract)
  ) {
    return { contractSnapshotChanged: true };
  }
  const service = services?.offerings?.find(({ id }) => id === quote.serviceId);
  if (
    !service ||
    quote.priceUsd !== service.priceUsd ||
    quote.deliverable !== service.deliverable ||
    quote.turnaround !== service.turnaroundLabel
  ) {
    throw new Error("quote service fields do not match the canonical catalog");
  }
  if (quote.chainId !== paymentContract.network.chainId) {
    throw new Error("quote chainId does not match the canonical payment contract");
  }
  if (!ADDRESS.test(quote.recipient ?? "")) {
    throw new Error("quote recipient is not a 20-byte Ethereum address");
  }
  if (
    normalizeAddress(quote.recipient) !==
    normalizeAddress(paymentContract.recipient.address)
  ) {
    throw new Error("quote recipient does not match the canonical payment contract");
  }
  if (!/^[1-9][0-9]*$/.test(quote.amountBaseUnits ?? "")) {
    throw new Error("quote amountBaseUnits must be a positive base-10 integer");
  }

  const canonicalAsset = paymentContract.supportedAssets.find(
    ({ symbol }) => symbol === quote.asset?.symbol,
  );
  if (
    !canonicalAsset ||
    !ADDRESS.test(canonicalAsset.contractAddress ?? "") ||
    canonicalAsset.kind !== quote.asset.kind ||
    canonicalAsset.decimals !== quote.asset.decimals ||
    normalizeAddress(canonicalAsset.contractAddress) !==
      normalizeAddress(quote.asset.contractAddress)
  ) {
    throw new Error("quote asset does not match the canonical payment contract");
  }

  const issuedAt = Date.parse(quote.issuedAt ?? "");
  const expiresAt = Date.parse(quote.expiresAt ?? "");
  const maximumValidity = paymentContract.quote.maxValidityDays * 86_400_000;
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > maximumValidity
  ) {
    throw new Error("quote has an invalid validity window");
  }

  const catalogAmount = (
    BigInt(service.priceUsd) *
    10n ** BigInt(canonicalAsset.decimals)
  ).toString();
  if (quote.amountBaseUnits !== catalogAmount) {
    throw new Error("quote amount does not match the canonical stablecoin price");
  }

  return { canonicalAsset, issuedAt, expiresAt };
}

function compareAmount(actual, expected, quote, baseValues) {
  if (actual === expected) return null;
  return receiptResult(quote, {
    ...baseValues,
    state: "manual-review",
    reasonCode: actual < expected ? "partial" : "overpayment",
    observedAmountBaseUnits: actual.toString(),
  });
}

export async function verifyServiceReceipt({
  quote,
  paymentContract,
  services,
  transactionHash,
  minimumConfirmations,
  rpc,
}) {
  if (!TRANSACTION_HASH.test(transactionHash ?? "")) {
    throw new Error("transactionHash must be a 32-byte 0x-prefixed hash");
  }
  transactionHash = transactionHash.toLowerCase();
  if (
    !Number.isSafeInteger(minimumConfirmations) ||
    minimumConfirmations < paymentContract.reconciliation.minimumConfirmations
  ) {
    throw new Error(
      `minimumConfirmations must be at least ${paymentContract.reconciliation.minimumConfirmations}`,
    );
  }

  const validation = validateQuote(
    quote,
    paymentContract,
    services,
  );
  if (validation.contractSnapshotChanged) {
    return receiptResult(quote, {
      state: "manual-review",
      reasonCode: "quote-contract-snapshot-changed",
    });
  }
  const { canonicalAsset, issuedAt, expiresAt } = validation;
  const chainId = Number(parseQuantity(await rpc("eth_chainId", []), "chainId"));
  if (chainId !== quote.chainId) {
    return receiptResult(quote, {
      state: "rejected",
      reasonCode: "wrong-chain",
      observedChainId: chainId,
    });
  }

  const [transaction, receipt, currentBlockHex] = await Promise.all([
    rpc("eth_getTransactionByHash", [transactionHash]),
    rpc("eth_getTransactionReceipt", [transactionHash]),
    rpc("eth_blockNumber", []),
  ]);
  if (!transaction || !receipt) {
    return receiptResult(quote, {
      state: "pending",
      reasonCode: "transaction-not-observed",
      receiptIdentity: { chainId, transactionHash },
    });
  }
  if (
    normalizeAddress(transaction.hash) !== normalizeAddress(transactionHash) ||
    normalizeAddress(receipt.transactionHash) !== normalizeAddress(transactionHash) ||
    transaction.blockNumber !== receipt.blockNumber
  ) {
    throw new Error("RPC returned conflicting transaction or receipt identity");
  }
  if (receipt.status !== "0x1") {
    return receiptResult(quote, {
      state: "rejected",
      reasonCode: "reverted-transaction",
      receiptIdentity: { chainId, transactionHash },
    });
  }

  const receiptBlock = parseQuantity(receipt.blockNumber, "receipt blockNumber");
  const currentBlock = parseQuantity(currentBlockHex, "current blockNumber");
  if (currentBlock < receiptBlock) {
    return receiptResult(quote, {
      state: "manual-review",
      reasonCode: "reorg-or-conflicting-evidence",
      receiptIdentity: { chainId, transactionHash },
    });
  }
  const confirmations = Number(currentBlock - receiptBlock + 1n);
  const baseValues = {
    transactionHash,
    blockNumber: Number(receiptBlock),
    blockHash: receipt.blockHash,
    confirmations,
    minimumConfirmations,
  };
  if (confirmations < minimumConfirmations) {
    return receiptResult(quote, {
      ...baseValues,
      state: "pending",
      reasonCode: "confirmation-depth-not-met",
      receiptIdentity: { chainId, transactionHash },
    });
  }

  const block = await rpc("eth_getBlockByNumber", [receipt.blockNumber, false]);
  if (
    !block ||
    block.number !== receipt.blockNumber ||
    normalizeAddress(block.hash) !== normalizeAddress(receipt.blockHash)
  ) {
    return receiptResult(quote, {
      ...baseValues,
      state: "manual-review",
      reasonCode: "reorg-or-conflicting-evidence",
      receiptIdentity: { chainId, transactionHash },
    });
  }
  const paidAt = Number(parseQuantity(block.timestamp, "block timestamp")) * 1000;
  if (paidAt < issuedAt || paidAt > expiresAt) {
    return receiptResult(quote, {
      ...baseValues,
      state: "manual-review",
      reasonCode: paidAt > expiresAt ? "late" : "reorg-or-conflicting-evidence",
      paidAt: new Date(paidAt).toISOString(),
      receiptIdentity: { chainId, transactionHash },
    });
  }

  const expectedAmount = BigInt(quote.amountBaseUnits);
  const recipientTopic = `0x${quote.recipient.slice(2).toLowerCase().padStart(64, "0")}`;
  const canonicalTransferLogs = (receipt.logs ?? []).filter(
    (log) =>
      normalizeAddress(log.address) === normalizeAddress(canonicalAsset.contractAddress) &&
      normalizeAddress(log.topics?.[0]) === TRANSFER_TOPIC,
  );
  const conflictingRecipientLog = canonicalTransferLogs.find(
    (log) =>
      normalizeAddress(log.topics?.[2]) === recipientTopic &&
      (log.removed === true ||
        log.topics?.length !== 3 ||
        !/^0x[0-9a-f]{64}$/i.test(log.data ?? "") ||
        normalizeAddress(log.transactionHash) !== normalizeAddress(transactionHash) ||
        log.blockNumber !== receipt.blockNumber ||
        normalizeAddress(log.blockHash) !== normalizeAddress(receipt.blockHash)),
  );
  if (conflictingRecipientLog) {
    return receiptResult(quote, {
      ...baseValues,
      state: "manual-review",
      reasonCode: "reorg-or-conflicting-evidence",
      receiptIdentity: { chainId, transactionHash },
    });
  }
  const transferLogs = canonicalTransferLogs.filter(
    (log) =>
      log.removed !== true &&
      log.topics?.length === 3 &&
      /^0x[0-9a-f]{64}$/i.test(log.data ?? "") &&
      normalizeAddress(log.transactionHash) === normalizeAddress(transactionHash) &&
      log.blockNumber === receipt.blockNumber &&
      normalizeAddress(log.blockHash) === normalizeAddress(receipt.blockHash),
  );
  const matchingLogs = transferLogs.filter(
    (log) => normalizeAddress(log.topics?.[2]) === recipientTopic,
  );
  if (matchingLogs.length === 0) {
    return receiptResult(quote, {
      ...baseValues,
      state: "rejected",
      reasonCode: "wrong-recipient",
      receiptIdentity: { chainId, transactionHash },
    });
  }
  if (matchingLogs.length !== 1) {
    return receiptResult(quote, {
      ...baseValues,
      state: "manual-review",
      reasonCode: "reorg-or-conflicting-evidence",
      receiptIdentity: { chainId, transactionHash },
    });
  }

  const transferLog = matchingLogs[0];
  const logIndex = Number(parseQuantity(transferLog.logIndex, "logIndex"));
  const receiptIdentity = { chainId, transactionHash, logIndex };
  const actualAmount = parseQuantity(transferLog.data, "transfer amount");
  const amountMismatch = compareAmount(actualAmount, expectedAmount, quote, {
    ...baseValues,
    receiptIdentity,
  });
  if (amountMismatch) return amountMismatch;

  return receiptResult(quote, {
    ...baseValues,
    state: "matched",
    reasonCode: "exact-quote-tuple-observed",
    paidAt: new Date(paidAt).toISOString(),
    observedAmountBaseUnits: actualAmount.toString(),
    receiptIdentity,
  });
}
