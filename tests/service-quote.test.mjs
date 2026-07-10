import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { createServiceQuote } from "../scripts/lib/service-quote.mjs";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);

const quoteId = "11111111-1111-4111-8111-111111111111";
const paymentReference = "22222222-2222-4222-8222-222222222222";

test("creates a complete deterministic but nonpayable USDC quote draft", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sentinel-quote-"));
  const requestPath = join(directory, "request.json");

  try {
    await writeFile(
      requestPath,
      JSON.stringify({
        serviceId: "agent-payment-boundary-review",
        requestTransport: "github-issue",
        publicDocumentUrls: ["https://example.com/agent.json"],
        intendedUse: "Check whether payer and recipient authority are distinct.",
        preferredFormat: "Markdown",
      }),
    );

    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/create-service-quote.mjs",
        "--request",
        requestPath,
        "--asset",
        "USDC",
        "--quote-id",
        quoteId,
        "--payment-reference",
        paymentReference,
        "--issued-at",
        "2026-07-10T20:00:00.000Z",
        "--expires-at",
        "2026-07-17T20:00:00.000Z",
      ],
      { cwd: new URL(".", root) },
    );

    const quote = JSON.parse(stdout);
    assert.equal(quote.kind, "sentinel-service-quote");
    assert.equal(quote.complete, true);
    assert.equal(quote.demonstration, false);
    assert.equal(quote.payable, false);
    assert.equal(quote.approvalState, "draft");
    assert.equal(quote.issuance.humanApproved, false);
    assert.equal(quote.issuance.channel, "github-issue");
    assert.equal(quote.quoteId, quoteId);
    assert.equal(quote.paymentReference, paymentReference);
    assert.equal(quote.serviceId, "agent-payment-boundary-review");
    assert.equal(quote.priceUsd, 49);
    assert.equal(quote.asset.symbol, "USDC");
    assert.equal(quote.amountBaseUnits, "49000000");
    assert.equal(quote.chainId, 1);
    assert.equal(
      quote.recipient,
      "0x91bdE13382c3Ee082EE42a147DF54f6A6129a412",
    );
    assert.equal(quote.issuedAt, "2026-07-10T20:00:00.000Z");
    assert.equal(quote.expiresAt, "2026-07-17T20:00:00.000Z");
    assert.match(quote.requestFingerprint, /^sha256:[0-9a-f]{64}$/);
    assert.match(
      quote.contractSnapshots.services.canonicalJsonSha256,
      /^[0-9a-f]{64}$/,
    );
    assert.match(
      quote.contractSnapshots.servicePayment.canonicalJsonSha256,
      /^[0-9a-f]{64}$/,
    );
    assert.match(quote.cancellationAndRefundTerms, /before payment/i);
    assert.match(quote.cancellationAndRefundTerms, /irreversible/i);
    assert.equal(quote.authorization.requestMovesFunds, false);
    assert.equal(quote.authorization.requestAuthorizesPayment, false);
    assert.equal(quote.authorization.payerMustFollowOwnPolicy, true);
    assert.equal(quote.authorization.outboundWalletActionRequiresHumanAuthorization, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("prepares a private quote artifact only after explicit human approval", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sentinel-workflow-quote-"));
  const outputPath = join(directory, "service-quote.json");
  const markdownPath = join(directory, "service-quote.md");
  const registryPath = join(directory, "approved-quotes.jsonl");

  try {
    await execFileAsync(process.execPath, ["scripts/prepare-service-quote.mjs"], {
      cwd: new URL(".", root),
      env: {
        ...process.env,
        SENTINEL_HUMAN_APPROVAL: "APPROVE",
        SENTINEL_REQUEST_JSON: JSON.stringify({
          serviceId: "agent-payment-boundary-review",
          requestTransport: "github-issue",
          publicDocumentUrls: ["https://example.com/agent.json"],
        }),
        SENTINEL_ASSET: "USDC",
        SENTINEL_VALIDITY_DAYS: "7",
        SENTINEL_QUOTE_OUTPUT: outputPath,
        SENTINEL_QUOTE_REGISTRY: registryPath,
      },
    });

    const quote = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(quote.payable, true);
    assert.equal(quote.issuance.humanApproved, true);
    assert.equal(quote.issuance.channel, "github-issue");
    assert.match(quote.quoteId, /^[0-9a-f-]{36}$/i);
    assert.match(quote.paymentReference, /^[0-9a-f-]{36}$/i);
    assert.equal(
      Date.parse(quote.expiresAt) - Date.parse(quote.issuedAt),
      7 * 24 * 60 * 60 * 1000,
    );
    const expectedDigest = createHash("sha256")
      .update(`${JSON.stringify(quote, null, 2)}\n`)
      .digest("hex");
    const registryEntries = (await readFile(registryPath, "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.deepEqual(registryEntries, [
      {
        quoteId: quote.quoteId,
        paymentReference: quote.paymentReference,
        quoteDigest: expectedDigest,
        issuedAt: quote.issuedAt,
        expiresAt: quote.expiresAt,
      },
    ]);
    const markdown = await readFile(markdownPath, "utf8");
    assert.match(markdown, /# Sentinel service quote/);
    assert.match(markdown, /summary only/i);
    assert.match(markdown, /exact byte-for-byte JSON quote/i);
    assert.match(markdown, /49 USDC/);
    assert.match(markdown, /49,000,000 base units/);
    assert.match(markdown, /0x91bdE13382c3Ee082EE42a147DF54f6A6129a412/);
    assert.match(markdown, /JSON quote SHA-256: `[0-9a-f]{64}`/);
    assert.match(markdown, /payer agent's own policy/i);
    assert.match(markdown, /does not authorize.*outbound/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects requests missing transport-specific or service-specific inputs", async () => {
  const [services, paymentContract] = await Promise.all([
    readFile(new URL("../public/services.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/service-payment.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const quoteOptions = {
    services,
    paymentContract,
    assetSymbol: "USDC",
    quoteId,
    paymentReference,
    issuedAt: "2026-07-10T20:00:00.000Z",
    expiresAt: "2026-07-17T20:00:00.000Z",
  };

  assert.throws(
    () =>
      createServiceQuote({
        ...quoteOptions,
        request: {
          serviceId: "agent-payment-boundary-review",
          requestTransport: "email",
          publicDocumentUrls: ["https://example.com/agent.json"],
        },
      }),
    /replyEmail/i,
  );
  assert.throws(
    () =>
      createServiceQuote({
        ...quoteOptions,
        request: {
          serviceId: "evidence-preview",
          requestTransport: "github-issue",
        },
      }),
    /chainId.*transactionHash/i,
  );
});

test("rejects a stablecoin underpayment override and credentialed public URLs", async () => {
  const [services, paymentContract] = await Promise.all([
    readFile(new URL("../public/services.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/service-payment.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const base = {
    request: {
      serviceId: "agent-payment-boundary-review",
      requestTransport: "github-issue",
      publicDocumentUrls: ["https://example.com/agent.json"],
    },
    services,
    paymentContract,
    assetSymbol: "USDC",
    quoteId,
    paymentReference,
    issuedAt: "2026-07-10T20:00:00.000Z",
    expiresAt: "2026-07-17T20:00:00.000Z",
  };

  assert.throws(
    () => createServiceQuote({ ...base, amountBaseUnits: "1" }),
    /USDC.*49000000/i,
  );
  assert.throws(
    () =>
      createServiceQuote({
        ...base,
        request: {
          ...base.request,
          publicDocumentUrls: ["https://user:secret@example.com/agent.json"],
        },
      }),
    /credentials/i,
  );
  assert.throws(
    () =>
      createServiceQuote({
        ...base,
        request: {
          ...base.request,
          publicDocumentUrls: ["https://[::1]/agent.json"],
        },
      }),
    /public hosts/i,
  );
});

test("removes a payable artifact when approved-quote registration fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sentinel-quote-rollback-"));
  const outputPath = join(directory, "service-quote.json");

  try {
    await assert.rejects(
      execFileAsync(process.execPath, ["scripts/prepare-service-quote.mjs"], {
        cwd: new URL(".", root),
        env: {
          ...process.env,
          SENTINEL_HUMAN_APPROVAL: "APPROVE",
          SENTINEL_REQUEST_JSON: JSON.stringify({
            serviceId: "agent-payment-boundary-review",
            requestTransport: "github-issue",
            publicDocumentUrls: ["https://example.com/agent.json"],
          }),
          SENTINEL_ASSET: "USDC",
          SENTINEL_VALIDITY_DAYS: "7",
          SENTINEL_QUOTE_OUTPUT: outputPath,
          SENTINEL_QUOTE_REGISTRY: directory,
        },
      }),
    );
    await assert.rejects(access(outputPath), (error) => error?.code === "ENOENT");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preserves a pre-existing Markdown file when quote preparation collides", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sentinel-quote-collision-"));
  const outputPath = join(directory, "service-quote.json");
  const markdownPath = join(directory, "service-quote.md");
  const registryPath = join(directory, "approved-quotes.jsonl");

  try {
    await writeFile(markdownPath, "keep me\n");
    await assert.rejects(
      execFileAsync(process.execPath, ["scripts/prepare-service-quote.mjs"], {
        cwd: new URL(".", root),
        env: {
          ...process.env,
          SENTINEL_HUMAN_APPROVAL: "APPROVE",
          SENTINEL_REQUEST_JSON: JSON.stringify({
            serviceId: "agent-payment-boundary-review",
            requestTransport: "github-issue",
            publicDocumentUrls: ["https://example.com/agent.json"],
          }),
          SENTINEL_ASSET: "USDC",
          SENTINEL_VALIDITY_DAYS: "7",
          SENTINEL_QUOTE_OUTPUT: outputPath,
          SENTINEL_QUOTE_REGISTRY: registryPath,
        },
      }),
    );
    assert.equal(await readFile(markdownPath, "utf8"), "keep me\n");
    await assert.rejects(access(outputPath), (error) => error?.code === "ENOENT");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects timezone-dependent quote timestamps", async () => {
  const [services, paymentContract] = await Promise.all([
    readFile(new URL("../public/services.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/service-payment.json", import.meta.url), "utf8").then(JSON.parse),
  ]);

  assert.throws(
    () =>
      createServiceQuote({
        request: {
          serviceId: "agent-payment-boundary-review",
          requestTransport: "github-issue",
          publicDocumentUrls: ["https://example.com/agent.json"],
        },
        services,
        paymentContract,
        assetSymbol: "USDC",
        quoteId,
        paymentReference,
        issuedAt: "2026-07-10T20:00:00",
        expiresAt: "2026-07-17T20:00:00.000Z",
      }),
    /canonical RFC3339/i,
  );
});

test("enforces the published request schema before creating a quote", async () => {
  const [services, paymentContract] = await Promise.all([
    readFile(new URL("../public/services.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/service-payment.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const base = {
    request: {
      serviceId: "agent-payment-boundary-review",
      requestTransport: "github-issue",
      publicDocumentUrls: ["https://example.com/agent.json"],
    },
    services,
    paymentContract,
    assetSymbol: "USDC",
    quoteId,
    paymentReference,
    issuedAt: "2026-07-10T20:00:00.000Z",
    expiresAt: "2026-07-17T20:00:00.000Z",
  };

  assert.throws(
    () =>
      createServiceQuote({
        ...base,
        request: { ...base.request, privateKey: "must-not-be-accepted" },
      }),
    /undeclared request field privateKey/i,
  );
  assert.throws(
    () =>
      createServiceQuote({
        ...base,
        request: { ...base.request, preferredFormat: "PDF" },
      }),
    /preferredFormat/i,
  );
});
