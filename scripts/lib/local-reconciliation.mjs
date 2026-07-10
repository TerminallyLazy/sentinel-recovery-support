import { createHash } from "node:crypto";
import { appendFile, open, readFile, unlink } from "node:fs/promises";

async function readJsonLines(path) {
  try {
    const value = await readFile(path, "utf8");
    return value
      .split("\n")
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(`invalid JSON on line ${index + 1} of ${path}`, {
            cause: error,
          });
        }
      });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function withLedgerLock(path, operation) {
  const lockPath = `${path}.lock`;
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`reconciliation ledger is locked: ${lockPath}`);
    }
    throw error;
  }

  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(lockPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

export async function requireApprovedQuote({ registryPath, quoteBytes, quote }) {
  const quoteDigest = createHash("sha256").update(quoteBytes).digest("hex");
  const entries = await readJsonLines(registryPath);
  const sameQuoteId = entries.filter(({ quoteId }) => quoteId === quote.quoteId);
  const sameReference = entries.filter(
    ({ paymentReference }) => paymentReference === quote.paymentReference,
  );
  const exact = sameQuoteId.filter(
    (entry) =>
      entry.paymentReference === quote.paymentReference &&
      entry.quoteDigest === quoteDigest &&
      entry.issuedAt === quote.issuedAt &&
      entry.expiresAt === quote.expiresAt,
  );

  if (exact.length !== 1 || sameQuoteId.length !== 1 || sameReference.length !== 1) {
    throw new Error(
      "quote is not uniquely registered in the human-approved quote registry",
    );
  }

  return { quoteDigest, registryEntry: exact[0] };
}

function receiptIdentityKey(identity) {
  return [
    identity.chainId,
    identity.transactionHash.toLowerCase(),
    identity.logIndex ?? "native",
  ].join(":");
}

export async function reconcileReceipt({
  ledgerPath,
  quote,
  quoteDigest,
  inspection,
}) {
  if (inspection.state !== "matched") {
    return {
      ...inspection,
      credited: false,
      idempotentReplay: false,
    };
  }

  return withLedgerLock(ledgerPath, async () => {
    const entries = await readJsonLines(ledgerPath);
    const identityKey = receiptIdentityKey(inspection.receiptIdentity);
    const receiptEntry = entries.find(
      ({ receiptIdentity }) => receiptIdentityKey(receiptIdentity) === identityKey,
    );
    if (receiptEntry) {
      if (
        receiptEntry.quoteId === quote.quoteId &&
        receiptEntry.paymentReference === quote.paymentReference &&
        receiptEntry.quoteDigest === quoteDigest
      ) {
        return {
          ...receiptEntry.result,
          idempotentReplay: true,
        };
      }
      return {
        ...inspection,
        state: "manual-review",
        reasonCode: "duplicate",
        credited: false,
        idempotentReplay: false,
        conflictingQuoteId: receiptEntry.quoteId,
      };
    }

    const quoteEntry = entries.find(
      (entry) =>
        entry.quoteId === quote.quoteId ||
        entry.paymentReference === quote.paymentReference,
    );
    if (quoteEntry) {
      return {
        ...inspection,
        state: "manual-review",
        reasonCode: "duplicate",
        credited: false,
        idempotentReplay: false,
      };
    }

    const result = {
      ...inspection,
      state: "verified",
      reasonCode: "exact-quote-tuple-confirmed",
      quoteDigest,
      credited: true,
      idempotentReplay: false,
    };
    await appendFile(
      ledgerPath,
      `${JSON.stringify({
        quoteId: quote.quoteId,
        paymentReference: quote.paymentReference,
        quoteDigest,
        receiptIdentity: inspection.receiptIdentity,
        result,
      })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    return result;
  });
}
