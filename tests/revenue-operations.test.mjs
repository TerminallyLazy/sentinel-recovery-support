import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { prepareServiceQuoteRequest } from "../mcp/quote-request.mjs";

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

test("keeps an MCP quote-request draft separate from a payable quote", () => {
  const draft = prepareServiceQuoteRequest({
    serviceId: "agent-payment-boundary-review",
    requestTransport: "github-issue",
    publicDocumentUrls: ["https://example.com/agent.json"],
  });

  assert.equal(draft.kind, "sentinel-service-quote-request-draft");
  assert.equal(draft.packetStatus, "complete-unsubmitted-request");
  assert.equal(draft.safety.requestMovesFunds, false);
  assert.equal(draft.safety.requestAuthorizesPayment, false);
  assert.equal(draft.safety.paymentInstructionsIncluded, false);
  assert.equal(draft.safety.createsServiceEntitlement, false);
  assert.equal(draft.safety.submitted, false);
  for (const forbiddenField of [
    "recipient",
    "asset",
    "amountBaseUnits",
    "quoteId",
    "paymentReference",
    "payable",
  ]) {
    assert.equal(Object.hasOwn(draft, forbiddenField), false);
  }
});

test("publishes a request-only 48-hour payment failure reproduction sprint", async () => {
  const [services, request, issueTemplate, pageSource, readme, manifest, guide, llms] = await Promise.all([
    readFile(new URL("public/services.json", root), "utf8").then(JSON.parse),
    readFile(new URL("public/service-request.json", root), "utf8").then(JSON.parse),
    readFile(new URL(".github/ISSUE_TEMPLATE/service-request.yml", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL("public/.well-known/sentinel-agent.json", root), "utf8").then(JSON.parse),
    readFile(new URL("public/agent-guide.md", root), "utf8"),
    readFile(new URL("public/llms.txt", root), "utf8"),
  ]);
  const serviceId = "48-hour-agent-payment-failure-reproduction-sprint";
  const sprint = services.offerings.find(({ id }) => id === serviceId);

  assert.ok(sprint, "expected the 48-hour sprint offering");
  assert.equal(sprint.title, "48-Hour Agent Payment Failure Reproduction Sprint");
  assert.equal(sprint.priceUsd, 1500);
  assert.equal(sprint.requestOnly, true);
  assert.equal(sprint.directPaymentEnabled, false);
  assert.equal(sprint.canonicalServicePaymentQuoteEligible, false);
  assert.equal(sprint.deliveryMode, "asynchronous");
  assert.equal(sprint.meetingsRequired, false);
  assert.equal("chainId" in sprint, false);
  assert.equal(sprint.networkScope, "protocol-agnostic");
  assert.equal(sprint.turnaroundHours, 48);
  assert.equal(sprint.securityCertification, false);
  assert.equal(sprint.penetrationTest, false);
  assert.equal(
    sprint.proofUrl,
    "https://terminallylazy.github.io/matchflight/",
  );
  assert.deepEqual(sprint.commercialTerms, {
    fixedScopePriceUsd: 1500,
    optionalKickoffUsd: 750,
    invoiceRails: ["ACH", "Wise", "Zelle"],
    kickoffRequiresSeparateHumanApprovedSow: true,
    invoiceIssuedOnlyAfterHumanApprovedSow: true,
    balanceAndAcceptanceTermsDefinedInSow: true,
    zelleRequiresSignedSowAndInvoice: true,
    zelleBuyerMustAcknowledgeNoPurchaseProtection: true,
    paymentInstructionsPublished: false,
  });
  assert.match(sprint.deliverable, /eight deterministic negative-path cases/i);
  assert.match(sprint.deliverable, /runnable Node regression harness/i);
  assert.match(sprint.deliverable, /findings\.json/i);
  assert.match(sprint.scopeLabel, /no certification/i);
  assert.match(sprint.scopeLabel, /no penetration test/i);
  assert.match(sprint.requestOnlyDisclosure, /separately human-approved SOW/i);
  assert.match(sprint.requestOnlyDisclosure, /publishes no payment instructions/i);
  assert.match(sprint.requestOnlyDisclosure, /no meeting or call is required/i);

  assert.ok(request.requestSchema.properties.serviceId.enum.includes(serviceId));
  const publicUrlCondition = request.requestSchema.allOf.find(
    (rule) =>
      rule.if?.properties?.serviceId?.const === serviceId ||
      rule.if?.properties?.serviceId?.enum?.includes(serviceId),
  );
  assert.ok(publicUrlCondition, "expected sprint public-URL input condition");
  assert.deepEqual(publicUrlCondition.then.required, ["publicDocumentUrls"]);
  assert.equal(
    request.workflow.requestOnlyOfferingRequiresSeparateHumanApprovedSow,
    true,
  );
  assert.equal(request.workflow.requestOnlyOfferingPublishesPaymentInstructions, false);
  assert.equal(
    services.payment.requestOnlyOfferingsRequireSeparateHumanApprovedSow,
    true,
  );
  assert.equal(services.payment.requestOnlyOfferingsPublishPaymentInstructions, false);
  assert.deepEqual(services.payment.requestOnlyInvoiceRails, ["ACH", "Wise", "Zelle"]);
  assert.doesNotMatch(
    JSON.stringify({ sprint, payment: services.payment }),
    /routing number|account number|bank address|swift|iban/i,
  );

  assert.match(issueTemplate, /48-Hour Agent Payment Failure Reproduction Sprint \(\$1,500\)/);
  assert.match(issueTemplate, /public repository, sandbox, or protocol URL/i);
  assert.match(request.transport.bodyTemplate, /chain ID \(case services only\)/i);
  assert.match(pageSource, /service\.requestOnlyDisclosure/);
  assert.match(pageSource, /service\.proofUrl/);
  assert.match(pageSource, /human-issued quote or SOW/i);
  assert.match(pageSource, /ACH, Wise, or Zelle invoice/i);
  assert.match(pageSource, /Zelle has no purchase protection/i);
  assert.match(readme, /48-Hour Agent Payment Failure Reproduction Sprint/i);
  assert.match(readme, /request-only/i);
  assert.match(readme, /MatchFlight/i);
  assert.match(readme, /requires no meeting or call/i);

  const requestCapability = manifest.capabilities.find(
    ({ id }) => id === "request_paid_evidence_service",
  );
  assert.equal(
    requestCapability.expectedResponse,
    "clarification-complete-quote-or-human-approved-sow",
  );
  assert.equal(
    requestCapability.canonicalPaymentContractAppliesToRequestOnlyOfferings,
    false,
  );
  assert.match(guide, /request-only.*human-approved SOW and invoice/is);
  assert.match(guide, /canonical crypto service-payment contract must not be used/i);
  assert.match(llms, /request-only \$1,500 sprint/i);
  assert.match(llms, /does not authorize payment for request-only offerings/i);
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
