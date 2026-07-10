import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("publishes a complete but nonpayable example quote", async () => {
  const sample = JSON.parse(
    await readFile(new URL("public/sample-service-quote.json", root), "utf8"),
  );

  assert.equal(sample.kind, "sentinel-service-quote");
  assert.equal(sample.complete, true);
  assert.equal(sample.demonstration, true);
  assert.equal(sample.payable, false);
  assert.equal(sample.approvalState, "demonstration");
  assert.equal(sample.serviceId, "agent-payment-boundary-review");
  assert.equal(sample.priceUsd, 49);
  assert.equal(sample.asset.symbol, "USDC");
  assert.equal(sample.amountBaseUnits, "49000000");
  assert.equal(sample.chainId, 1);
  assert.equal(
    sample.recipient,
    "0x91bdE13382c3Ee082EE42a147DF54f6A6129a412",
  );
  assert.ok(Date.parse(sample.expiresAt) < Date.parse("2026-07-10T00:00:00Z"));
  assert.match(sample.nonPaymentWarning, /do not pay/i);

  for (const field of [
    "quoteId",
    "paymentReference",
    "issuedAt",
    "expiresAt",
    "deliverable",
    "turnaround",
    "cancellationAndRefundTerms",
  ]) {
    assert.ok(sample[field], `expected sample field ${field}`);
  }
});

test("does not expose payable quote artifacts through public GitHub Actions", async () => {
  await assert.rejects(
    access(new URL(".github/workflows/prepare-service-quote.yml", root)),
    (error) => error?.code === "ENOENT",
  );
});

test("routine cleanup never deletes a user-owned pages directory", async () => {
  const cleanup = await readFile(
    new URL("scripts/clean-pages.mjs", root),
    "utf8",
  );

  assert.doesNotMatch(cleanup, /rm\([^\n]*["']pages["']/);
  assert.match(cleanup, /\.pages-artifact/);
});

test("documents the human-run quote and read-only receipt commands", async () => {
  const [readme, operations, paymentContract, packageJson] = await Promise.all([
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("docs/service-operations.md", root), "utf8"),
    readFile(new URL("public/service-payment.json", root), "utf8").then(
      JSON.parse,
    ),
    readFile(new URL("package.json", root), "utf8").then(JSON.parse),
  ]);

  assert.match(readme, /sample-service-quote\.json/);
  assert.match(readme, /create-service-quote\.mjs/);
  assert.match(readme, /SENTINEL_QUOTE_REGISTRY/);
  assert.match(readme, /verify-service-receipt\.mjs/);
  assert.match(readme, /--quote-registry/);
  assert.match(readme, /--receipt-ledger/);
  assert.match(readme, /does not issue or\s*publish the quote/i);
  assert.match(readme, /does not sign,\s*broadcast, spend, or move funds/i);
  assert.match(operations, /exact byte-for-byte JSON/i);
  assert.match(operations, /do not reformat/i);
  assert.match(operations, /JSON.*SHA-256.*Markdown/i);
  assert.equal(
    paymentContract.quote.digestSemantics.canonicalJson.representation,
    "sentinel-canonical-json-v1",
  );
  assert.equal(
    paymentContract.quote.digestSemantics.canonicalJson.encoding,
    "utf-8",
  );
  assert.match(
    paymentContract.quote.digestSemantics.canonicalJson.referenceImplementation,
    /^https:\/\/github\.com\//,
  );
  assert.match(
    paymentContract.quote.digestSemantics.requestFingerprint.input,
    /validated request JSON object/i,
  );
  assert.match(
    paymentContract.quote.digestSemantics.contractSnapshots.input,
    /parsed canonical contract JSON object/i,
  );
  assert.equal(
    packageJson.scripts["test:revenue"],
    "node --test tests/service-quote.test.mjs tests/service-receipt.test.mjs tests/revenue-operations.test.mjs",
  );
});
