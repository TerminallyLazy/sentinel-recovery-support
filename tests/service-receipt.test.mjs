import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  reconcileReceipt,
  requireApprovedQuote,
} from "../scripts/lib/local-reconciliation.mjs";
import { verifyServiceReceipt } from "../scripts/lib/service-receipt.mjs";
import {
  canonicalJsonDigest,
  createServiceQuote,
} from "../scripts/lib/service-quote.mjs";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const recipient = "0x91bdE13382c3Ee082EE42a147DF54f6A6129a412";
const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const transactionHash = `0x${"ab".repeat(32)}`;
const mixedCaseTransactionHash = `0x${"Ab".repeat(32)}`;
const transferTopic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const topicAddress = (address) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
const quantity = (value) => `0x${BigInt(value).toString(16)}`;
const uint256 = (value) => `0x${BigInt(value).toString(16).padStart(64, "0")}`;

async function withRpc(responses, callback) {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rpcRequest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: rpcRequest.id,
        result: responses[rpcRequest.method] ?? null,
      }),
    );
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("verifies an exact confirmed canonical USDC receipt without wallet access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sentinel-receipt-"));
  const quotePath = join(directory, "quote.json");
  const quoteRegistryPath = join(directory, "approved-quotes.jsonl");
  const receiptLedgerPath = join(directory, "service-receipts.jsonl");
  const blockNumber = 100n;

  try {
    const [services, paymentContract] = await Promise.all([
      readFile(new URL("../public/services.json", import.meta.url), "utf8").then(JSON.parse),
      readFile(new URL("../public/service-payment.json", import.meta.url), "utf8").then(JSON.parse),
    ]);
    const quote = {
        schemaVersion: "1.0",
        kind: "sentinel-service-quote",
        complete: true,
        demonstration: false,
        payable: true,
        approvalState: "approved",
        issuance: {
          humanApproved: true,
          channel: "github-issue",
          issuerEmail: "sentinel@genesysx.org",
          deliveryRequiredThroughSelectedReplyChannel: true,
          payerMustVerifySentinelControlledReplySource: true,
          standaloneCryptographicSignaturePresent: false,
        },
        quoteId: "11111111-1111-4111-8111-111111111111",
        serviceId: "agent-payment-boundary-review",
        requestFingerprint: `sha256:${"12".repeat(32)}`,
        priceUsd: 49,
        asset: {
          symbol: "USDC",
          kind: "erc20",
          decimals: 6,
          contractAddress: usdc,
        },
        amountBaseUnits: "49000000",
        chainId: 1,
        recipient,
        paymentReference: "22222222-2222-4222-8222-222222222222",
        issuedAt: "2026-07-10T20:00:00.000Z",
        expiresAt: "2026-07-17T20:00:00.000Z",
        deliverable:
          "One-page findings matrix with cited fields, contradictions, missing safety statements, and prioritized corrections.",
        turnaround:
          "Target within 1 business day after verified payment and complete public inputs.",
        cancellationAndRefundTerms: "Cancel before payment; payments are irreversible.",
        canonicalContracts: {
          servicePayment: paymentContract.canonicalUrl,
          serviceRequest: paymentContract.serviceRequestContract,
        },
        paymentInstructions:
          "Pay only the exact approved tuple and return the transaction hash.",
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
      };
    const quoteBytes = `${JSON.stringify(quote, null, 2)}\n`;
    const quoteDigest = createHash("sha256").update(quoteBytes).digest("hex");
    await writeFile(quotePath, quoteBytes);
    await writeFile(
      quoteRegistryPath,
      `${JSON.stringify({
        quoteId: quote.quoteId,
        paymentReference: quote.paymentReference,
        quoteDigest,
        issuedAt: quote.issuedAt,
        expiresAt: quote.expiresAt,
      })}\n`,
    );

    await withRpc(
      {
        eth_chainId: "0x1",
        eth_blockNumber: quantity(blockNumber + 12n),
        eth_getTransactionByHash: {
          hash: transactionHash,
          to: usdc,
          value: "0x0",
          blockNumber: quantity(blockNumber),
        },
        eth_getTransactionReceipt: {
          transactionHash,
          status: "0x1",
          blockNumber: quantity(blockNumber),
          blockHash: `0x${"cd".repeat(32)}`,
          logs: [
            {
              address: usdc,
              logIndex: "0x3",
              transactionHash,
              blockNumber: quantity(blockNumber),
              blockHash: `0x${"cd".repeat(32)}`,
              removed: false,
              topics: [
                transferTopic,
                topicAddress("0x1234567890123456789012345678901234567890"),
                topicAddress(recipient),
              ],
              data: uint256(49_000_000n),
            },
          ],
        },
        eth_getBlockByNumber: {
          number: quantity(blockNumber),
          hash: `0x${"cd".repeat(32)}`,
          timestamp: quantity(
            BigInt(Date.parse("2026-07-11T20:00:00.000Z") / 1000),
          ),
        },
      },
      async (rpcUrl) => {
        const commandArguments = [
            "scripts/verify-service-receipt.mjs",
            "--quote",
            quotePath,
            "--quote-registry",
            quoteRegistryPath,
            "--receipt-ledger",
            receiptLedgerPath,
            "--transaction-hash",
            mixedCaseTransactionHash,
            "--rpc-url",
            rpcUrl,
            "--confirmations",
            "12",
          ];
        const { stdout } = await execFileAsync(
          process.execPath,
          commandArguments,
          { cwd: new URL(".", root) },
        );

        const result = JSON.parse(stdout);
        assert.equal(result.state, "verified", JSON.stringify(result));
        assert.equal(result.reasonCode, "exact-quote-tuple-confirmed");
        assert.equal(result.quoteId, "11111111-1111-4111-8111-111111111111");
        assert.deepEqual(result.receiptIdentity, {
          chainId: 1,
          transactionHash,
          logIndex: 3,
        });
        assert.equal(result.confirmations, 13);
        assert.equal(result.movesFunds, false);
        assert.equal(result.requestsWalletAccess, false);
        assert.equal(result.credited, true);
        assert.equal(result.idempotentReplay, false);

        const replay = await execFileAsync(process.execPath, commandArguments, {
          cwd: new URL(".", root),
        });
        const replayResult = JSON.parse(replay.stdout);
        assert.equal(replayResult.state, "verified");
        assert.equal(replayResult.credited, true);
        assert.equal(replayResult.idempotentReplay, true);
        assert.equal(
          (await readFile(receiptLedgerPath, "utf8")).trim().split("\n").length,
          1,
        );
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a nonpayable demonstration quote before any RPC request", async () => {
  const [quote, paymentContract] = await Promise.all([
    readFile(new URL("../public/sample-service-quote.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/service-payment.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  let rpcCalled = false;

  await assert.rejects(
    verifyServiceReceipt({
      quote,
      paymentContract,
      transactionHash,
      minimumConfirmations: 12,
      rpc: async () => {
        rpcCalled = true;
        throw new Error("RPC must not be called for a nonpayable quote");
      },
    }),
    /approved payable non-demonstration quote/i,
  );
  assert.equal(rpcCalled, false);
});

test("rejects quote tampering and prevents cross-quote receipt replay", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sentinel-reconcile-"));
  const registryPath = join(directory, "approved-quotes.jsonl");
  const ledgerPath = join(directory, "receipts.jsonl");
  const quote = {
    quoteId: "11111111-1111-4111-8111-111111111111",
    paymentReference: "22222222-2222-4222-8222-222222222222",
    issuedAt: "2026-07-10T20:00:00.000Z",
    expiresAt: "2026-07-17T20:00:00.000Z",
    amountBaseUnits: "49000000",
  };
  const quoteBytes = Buffer.from(`${JSON.stringify(quote, null, 2)}\n`);
  const quoteDigest = createHash("sha256").update(quoteBytes).digest("hex");

  try {
    await writeFile(
      registryPath,
      `${JSON.stringify({
        quoteId: quote.quoteId,
        paymentReference: quote.paymentReference,
        quoteDigest,
        issuedAt: quote.issuedAt,
        expiresAt: quote.expiresAt,
      })}\n`,
    );
    await assert.rejects(
      requireApprovedQuote({
        registryPath,
        quoteBytes: Buffer.from(
          `${JSON.stringify({ ...quote, amountBaseUnits: "1" }, null, 2)}\n`,
        ),
        quote: { ...quote, amountBaseUnits: "1" },
      }),
      /not uniquely registered/i,
    );

    const inspection = {
      state: "matched",
      reasonCode: "exact-quote-tuple-observed",
      receiptIdentity: { chainId: 1, transactionHash, logIndex: 3 },
      movesFunds: false,
      requestsWalletAccess: false,
    };
    const first = await reconcileReceipt({
      ledgerPath,
      quote,
      quoteDigest,
      inspection,
    });
    assert.equal(first.state, "verified");
    assert.equal(first.credited, true);

    const duplicate = await reconcileReceipt({
      ledgerPath,
      quote: {
        ...quote,
        quoteId: "33333333-3333-4333-8333-333333333333",
        paymentReference: "44444444-4444-4444-8444-444444444444",
      },
      quoteDigest: "56".repeat(32),
      inspection: {
        ...inspection,
        receiptIdentity: {
          ...inspection.receiptIdentity,
          transactionHash: mixedCaseTransactionHash,
        },
      },
    });
    assert.equal(duplicate.state, "manual-review");
    assert.equal(duplicate.reasonCode, "duplicate");
    assert.equal(duplicate.credited, false);
    assert.equal(duplicate.conflictingQuoteId, quote.quoteId);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("routes a changed contract snapshot to manual review before RPC", async () => {
  const [services, paymentContract] = await Promise.all([
    readFile(new URL("../public/services.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/service-payment.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const quote = createServiceQuote({
    request: {
      serviceId: "agent-payment-boundary-review",
      requestTransport: "github-issue",
      publicDocumentUrls: ["https://example.com/agent.json"],
    },
    services,
    paymentContract,
    assetSymbol: "USDC",
    quoteId: "11111111-1111-4111-8111-111111111111",
    paymentReference: "22222222-2222-4222-8222-222222222222",
    issuedAt: "2026-07-10T20:00:00.000Z",
    expiresAt: "2026-07-17T20:00:00.000Z",
    payable: true,
  });
  const changedServices = structuredClone(services);
  changedServices.offerings[0].deliverable = "Changed after quote issuance.";
  let rpcCalled = false;

  const result = await verifyServiceReceipt({
    quote,
    paymentContract,
    services: changedServices,
    transactionHash,
    minimumConfirmations: 12,
    rpc: async () => {
      rpcCalled = true;
      throw new Error("RPC must not run after a contract snapshot change");
    },
  });

  assert.equal(result.state, "manual-review");
  assert.equal(result.reasonCode, "quote-contract-snapshot-changed");
  assert.equal(rpcCalled, false);
});
