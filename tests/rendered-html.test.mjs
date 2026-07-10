import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const siteBase =
  "https://terminallylazy.github.io/sentinel-recovery-support/";
const supportWallet = "0x91bdE13382c3Ee082EE42a147DF54f6A6129a412";

async function readJson(path) {
  try {
    return JSON.parse(await readFile(new URL(path, root), "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function readText(path) {
  try {
    return await readFile(new URL(path, root), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Sentinel support surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Sentinel Recovery — Ethereum Evidence Services<\/title>/i,
  );
  assert.match(
    html,
    /Request fixed-scope \$49\/\$99\/\$199 public-data reviews or support evidence-first tooling/i,
  );
  assert.match(html, /Fund evidence work that refuses to overclaim/i);
  assert.match(html, /0x91bdE13382c3Ee082EE42a147DF54f6A6129a412/);
  assert.match(
    html,
    /ethereum:0x91bdE13382c3Ee082EE42a147DF54f6A6129a412@1/,
  );
  assert.match(
    html,
    /etherscan\.io\/address\/0x91bdE13382c3Ee082EE42a147DF54f6A6129a412/,
  );
  assert.match(html, /0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/);
  assert.match(html, /0xdAC17F958D2ee523a2206206994597C13D831ec7/);
  assert.match(html, /NO RECOVERY GUARANTEE/);
  assert.match(html, /HUMAN AUTHORIZATION/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("renders the stable public outreach permalink", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(
    html,
    /agentssociety\.ai\/post\/mira-kepler-mre10zcy-1fa690--00071716-77eb-4829-a7dd-d004be95d9a6/,
  );
});

test("renders the durable main-branch source link", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(
    html,
    /github\.com\/TerminallyLazy\/sentinel-recovery-support\/tree\/main/,
  );
  assert.doesNotMatch(html, /github\.com\/TerminallyLazy\/sentinel-recovery\/tree\/main/);
  assert.doesNotMatch(html, /codex\/donation-revenue/);
});

test("renders a mobile contribution jump link", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /href="#support"[^>]*>View contribution options<\/a>/i);
  assert.match(
    html,
    /(?:id="support"[^>]*class="support-card"|class="support-card"[^>]*id="support")/i,
  );
  assert.match(html, /href="#services"[^>]*>View paid evidence services<\/a>/i);
});

test("removes starter artifacts and publishes agent discovery files", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", root)));

  const [manifest, support, guide, llms, packageJson, privacy, servicePayment] = await Promise.all([
    readFile(new URL("public/.well-known/sentinel-agent.json", root), "utf8"),
    readFile(new URL("public/support.json", root), "utf8"),
    readFile(new URL("public/agent-guide.md", root), "utf8"),
    readFile(new URL("public/llms.txt", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("public/privacy.json", root), "utf8"),
    readFile(new URL("public/service-payment.json", root), "utf8"),
  ]);

  assert.match(manifest, /payer-agent-delegated-policy/);
  assert.match(manifest, /91bdE13382c3Ee082EE42a147DF54f6A6129a412/);
  assert.match(support, /A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/);
  assert.match(support, /dAC17F958D2ee523a2206206994597C13D831ec7/);
  assert.match(guide, /payer agent may send autonomously/i);
  assert.match(guide, /email cannot change the canonical recipient/i);
  assert.match(llms, /Voluntary Ethereum Mainnet support/);
  assert.match(privacy, /identityDocumentsRequested/);
  assert.match(servicePayment, /writtenEmailCannotChangeRecipient/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.equal(
    JSON.parse(packageJson).scripts.predev,
    "node scripts/clean-pages.mjs",
  );
  assert.equal(
    JSON.parse(packageJson).scripts["preview:pages"],
    "npm run export:pages && node scripts/preview-pages.mjs",
  );
});

test("publishes canonical GitHub Pages interfaces for agents", async () => {
  const [manifest, guide, llms] = await Promise.all([
    readJson("public/.well-known/sentinel-agent.json"),
    readFile(new URL("public/agent-guide.md", root), "utf8"),
    readFile(new URL("public/llms.txt", root), "utf8"),
  ]);

  assert.ok(manifest, "expected the agent manifest to exist");
  assert.deepEqual(manifest.interfaces, {
    human: siteBase,
    guide: `${siteBase}agent-guide.md`,
    llms: `${siteBase}llms.txt`,
    support: `${siteBase}support.json`,
    supportIntent: `${siteBase}support-intent.json`,
    services: `${siteBase}services.json`,
    serviceRequest: `${siteBase}service-request.json`,
    sampleAgentPaymentBoundaryReview: `${siteBase}sample-agent-payment-boundary-review.json`,
    sampleEvidencePreview: `${siteBase}sample-evidence-preview.json`,
    servicePayment: `${siteBase}service-payment.json`,
    privacy: `${siteBase}privacy.json`,
    impactReceipts: `${siteBase}impact.json`,
  });
  assert.match(guide, new RegExp(`${siteBase}support\\.json`));
  assert.match(llms, new RegExp(`${siteBase}support-intent\\.json`));
  assert.doesNotMatch(guide, /\]\(\/(?:\.well-known|agent-guide|llms|support)/);
  assert.doesNotMatch(llms, /\]\(\/(?:\.well-known|agent-guide|llms|support)/);
});

test("publishes a source-installable read-only MCP resource adapter", async () => {
  const [manifest, mcpPackage, mcpReadme, readme, workflow, serverSource] =
    await Promise.all([
      readJson("public/.well-known/sentinel-agent.json"),
      readJson("mcp/package.json"),
      readText("mcp/README.md"),
      readText("README.md"),
      readText(".github/workflows/deploy-pages.yml"),
      readText("mcp/server.mjs"),
    ]);

  assert.deepEqual(manifest.mcp, {
    transport: "stdio",
    distributionStatus: "source-only",
    remoteEndpointAvailable: false,
    source: {
      repository:
        "https://github.com/TerminallyLazy/sentinel-recovery-support",
      path: "mcp",
      workingDirectory: "mcp",
      installCommand: "npm ci --ignore-scripts",
      startCommand: "node server.mjs",
    },
    capabilities: {
      tools: [],
      resources: [
        {
          uri: "sentinel://services/catalog",
          sourceUrl: `${siteBase}services.json`,
        },
        {
          uri: "sentinel://services/quote-request-contract",
          sourceUrl: `${siteBase}service-request.json`,
        },
      ],
    },
    safety: {
      readOnly: true,
      movesFunds: false,
      submitsQuoteRequest: false,
      authorizesPayment: false,
      requestsCredentials: false,
    },
  });
  assert.equal(mcpPackage.name, "sentinel-recovery-mcp");
  assert.equal(
    mcpPackage.mcpName,
    "io.github.terminallylazy/sentinel-recovery-services",
  );
  assert.equal(mcpPackage.license, "UNLICENSED");
  assert.match(mcpReadme, /source-only/i);
  assert.match(mcpReadme, /sentinel:\/\/services\/catalog/);
  assert.match(mcpReadme, /moves no funds/i);
  assert.match(readme, /npm ci --prefix mcp --ignore-scripts/);
  assert.match(readme, /node.*mcp\/server\.mjs/);
  assert.match(workflow, /npm ci --prefix mcp --ignore-scripts/);
  assert.match(workflow, /npm test --prefix mcp/);
  assert.match(workflow, /npm audit --prefix mcp --audit-level=high/);
  assert.match(workflow, /npm run pack:check --prefix mcp/);
  assert.doesNotMatch(serverSource, /registerTool/);
});

test("advertises an actionable paid-service request capability", async () => {
  const manifest = await readJson("public/.well-known/sentinel-agent.json");
  const capability = manifest.capabilities.find(
    ({ id }) => id === "request_paid_evidence_service",
  );

  assert.ok(capability, "expected the paid-service request capability");
  assert.equal(capability.requestContract, `${siteBase}service-request.json`);
  assert.deepEqual(capability.transport, {
    method: "email",
    to: "sentinel@genesysx.org",
  });
  assert.equal(
    capability.inputSchema,
    `${siteBase}service-request.json#/requestSchema`,
  );
  assert.equal(capability.expectedResponse, "clarification-or-complete-quote");
});

test("publishes one canonical service-request URL across agent interfaces", async () => {
  const [services, payment, guide, llms, readme] = await Promise.all([
    readJson("public/services.json"),
    readJson("public/service-payment.json"),
    readFile(new URL("public/agent-guide.md", root), "utf8"),
    readFile(new URL("public/llms.txt", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
  ]);
  const requestUrl = `${siteBase}service-request.json`;

  assert.equal(services.contact.requestContract, requestUrl);
  assert.equal(payment.serviceRequestContract, requestUrl);
  assert.match(guide, new RegExp(requestUrl.replaceAll(".", "\\.")));
  assert.match(llms, new RegExp(requestUrl.replaceAll(".", "\\.")));
  assert.match(readme, new RegExp(requestUrl.replaceAll(".", "\\.")));
});

test("publishes a delegated-payer support intent with human-only outbound use", async () => {
  const intent = await readJson("public/support-intent.json");

  assert.ok(intent, "expected public/support-intent.json to exist");
  assert.equal(intent.payment.chainId, 1);
  assert.equal(intent.payment.recipient, supportWallet);
  assert.deepEqual(intent.payment.supportedAssets, [
    {
      symbol: "ETH",
      kind: "native",
      decimals: 18,
      contractAddress: null,
    },
    {
      symbol: "USDC",
      kind: "erc20",
      decimals: 6,
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    {
      symbol: "USDT",
      kind: "erc20",
      decimals: 6,
      contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
  ]);
  assert.equal(intent.payment.fees.networkFeesAdditional, true);
  assert.equal(intent.payment.fees.mayExceedContributionAmount, true);
  assert.equal(intent.payment.fees.estimateBeforeSending, true);
  assert.equal("autonomousExecutionAllowed" in intent.authorization, false);
  assert.equal(
    intent.authorization.payerAgentMaySendWithinDelegatedAuthority,
    true,
  );
  assert.equal(intent.authorization.payerAgentMustFollowOwnPolicy, true);
  assert.equal(intent.authorization.recipientHumanAcceptanceRequired, false);
  assert.equal(intent.authorization.inboundReceiptMayBeObservedAutomatically, true);
  assert.equal(
    intent.authorization.outboundWalletActionRequiresHumanAuthorization,
    true,
  );
  assert.equal(intent.terms.createsServiceEntitlement, false);
  assert.equal(intent.terms.guaranteesRecovery, false);
});

test("keeps payer and recipient wallet authority direction-specific", async () => {
  const [supportDocument, intent, services, payment] = await Promise.all([
    readJson("public/support.json"),
    readJson("public/support-intent.json"),
    readJson("public/services.json"),
    readJson("public/service-payment.json"),
  ]);
  const support = supportDocument.support;

  assert.equal(
    "financialActionRequiresExplicitHumanAuthorization" in support,
    false,
  );
  for (const contract of [support.authorization, intent.authorization, payment.authorization]) {
    assert.equal(contract.payerAgentMaySendWithinDelegatedAuthority, true);
    assert.equal(contract.payerAgentMustFollowOwnPolicy, true);
    assert.equal(contract.recipientHumanAcceptanceRequired, false);
    assert.equal(contract.inboundReceiptMayBeObservedAutomatically, true);
    assert.equal(contract.outboundWalletActionRequiresHumanAuthorization, true);
  }
  assert.match(services.requestProcess[0], /human or payer agent/i);
  assert.match(services.requestProcess[2], /requester decides/i);
  assert.doesNotMatch(services.requestProcess.join(" "), /the human decides/i);
});

test("publishes a truthful zero-receipt impact snapshot", async () => {
  const impact = await readJson("public/impact.json");

  assert.ok(impact, "expected public/impact.json to exist");
  assert.equal(impact.snapshot.baselineBlock, 25_497_834);
  assert.equal(impact.snapshot.observedThroughBlock, 25_498_257);
  assert.equal(
    impact.snapshot.verification.nativeStateCheckedThroughBlock,
    25_498_257,
  );
  assert.equal(
    impact.snapshot.verification.canonicalTokenTransferLogsCheckedThroughBlock,
    25_498_262,
  );
  assert.equal(impact.snapshot.confirmedReceiptCount, 0);
  assert.deepEqual(impact.snapshot.confirmedReceipts, []);
  assert.equal(impact.snapshot.balances.ETH.baseUnits, "0");
  assert.equal(impact.snapshot.balances.USDC.baseUnits, "0");
  assert.equal(impact.snapshot.balances.USDT.baseUnits, "0");
  assert.deepEqual(impact.impact.contributionFundedWork, []);
  assert.doesNotMatch(JSON.stringify(impact), /sentinel-recovery\/pull|automated tests passed/i);
  assert.match(impact.limitations.join(" "), /historical snapshot.*not a live/i);
});

test("warns humans that network fees are additional", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(
    html,
    /Ethereum network fees are additional and may exceed small contribution amounts/i,
  );
});

test("publishes a fixed-scope paid evidence funnel", async () => {
  const [response, services] = await Promise.all([
    render(),
    readJson("public/services.json"),
  ]);
  const html = await response.text();

  assert.match(html, /Need a deliverable, not a donation\?/i);
  assert.match(html, /Claimant Context Intake/i);
  assert.match(html, /does not verify identity or wallet ownership/i);
  assert.match(html, /Evidence Preview/i);
  assert.match(html, /Trace Snapshot/i);
  assert.match(html, /one direct hop,? and up to 25 outbound transfers/i);
  assert.match(html, /block hash and number with UTC timestamp/i);
  assert.match(
    html,
    /mailto:sentinel@genesysx\.org\?subject=Sentinel%20Evidence%20Preview/i,
  );
  assert.match(html, />sentinel@genesysx\.org<\/a>/i);

  assert.ok(services, "expected public/services.json to exist");
  assert.equal(services.contact.email, "sentinel@genesysx.org");
  assert.deepEqual(
    services.offerings.map(({ id, priceUsd }) => ({ id, priceUsd })),
    [
      { id: "agent-payment-boundary-review", priceUsd: 49 },
      { id: "claimant-context-intake", priceUsd: 49 },
      { id: "evidence-preview", priceUsd: 99 },
      { id: "trace-snapshot", priceUsd: 199 },
    ],
  );
  const claimant = services.offerings.find(
    ({ id }) => id === "claimant-context-intake",
  );
  const preview = services.offerings.find(({ id }) => id === "evidence-preview");
  const trace = services.offerings.find(({ id }) => id === "trace-snapshot");
  assert.equal(claimant.verifiesIdentityOrWalletOwnership, false);
  assert.equal(preview.turnaroundBusinessDays, 2);
  assert.equal(trace.scope.maxDirectOutboundTransfers, 25);
  assert.equal(trace.scope.maxHops, 1);
  assert.ok(
    services.offerings.every(({ chainId }) => chainId === 1),
    "expected every paid offering to be Ethereum Mainnet only",
  );
  assert.equal(services.payment.sendOnlyAfterWrittenConfirmation, true);
  assert.equal(services.payment.directPaymentFromThisPageEnabled, false);
  assert.equal(
    services.payment.voluntarySupportMetadataIsNotServicePaymentInstructions,
    true,
  );
  assert.equal(services.payment.serviceTermsProvidedBeforePayment, true);
  assert.equal(services.payment.quoteExpiresAfterDays, 7);
  assert.equal(
    services.payment.canonicalPaymentContract,
    `${siteBase}service-payment.json`,
  );
  assert.equal(services.payment.writtenEmailCannotChangeRecipient, true);
  assert.equal(services.safety.requestsKeysOrSeedPhrases, false);
  assert.equal(services.safety.guaranteesRecovery, false);
  assert.equal(services.safety.providesIdentityAttribution, false);
  assert.equal(services.safety.providesLegalOrTaxAdvice, false);

  const pageSource = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(pageSource, /import servicesCatalog from "\.\.\/public\/services\.json"/);
  assert.doesNotMatch(pageSource, /const paidServices\s*=\s*\[/);
});

test("publishes a fixed-scope payment-boundary review for agent builders", async () => {
  const [response, services, request] = await Promise.all([
    render(),
    readJson("public/services.json"),
    readJson("public/service-request.json"),
  ]);
  const html = await response.text();
  const offer = services.offerings.find(
    ({ id }) => id === "agent-payment-boundary-review",
  );

  assert.ok(offer, "expected the agent payment boundary review offer");
  assert.equal(offer.priceUsd, 49);
  assert.deepEqual(offer.requiredInputs, [
    "one public HTTPS agent, payment, or support manifest URL",
    "reachable email address",
  ]);
  assert.deepEqual(offer.scope, {
    maxPublicDocuments: 2,
    maxCombinedBytes: 100000,
  });
  assert.match(offer.summary, /payer authority/i);
  assert.match(offer.deliverable, /findings matrix/i);
  assert.match(html, /Agent Payment Boundary Review/i);
  assert.match(html.replace(/<[^>]*>/g, ""), /Open \$49 email draft/i);
  assert.ok(
    request.requestSchema.properties.serviceId.enum.includes(
      "agent-payment-boundary-review",
    ),
  );
  const agentCondition = request.requestSchema.allOf.find(
    (rule) =>
      rule.if?.properties?.serviceId?.const ===
      "agent-payment-boundary-review",
  );
  assert.ok(agentCondition, "expected agent-review conditional inputs");
  assert.deepEqual(agentCondition.then.required, ["publicDocumentUrls"]);
});

test("publishes an inspectable Agent Payment Boundary Review sample before payment", async () => {
  const [response, sample, markdown, services, manifest, guide, llms, readme] =
    await Promise.all([
      render(),
      readJson("public/sample-agent-payment-boundary-review.json"),
      readText("public/sample-agent-payment-boundary-review.md"),
      readJson("public/services.json"),
      readJson("public/.well-known/sentinel-agent.json"),
      readFile(new URL("public/agent-guide.md", root), "utf8"),
      readFile(new URL("public/llms.txt", root), "utf8"),
      readFile(new URL("README.md", root), "utf8"),
    ]);
  const html = await response.text();
  const sampleUrl = `${siteBase}sample-agent-payment-boundary-review.json`;
  const sampleMarkdownUrl =
    `${siteBase}sample-agent-payment-boundary-review.md`;
  const offer = services.offerings.find(
    ({ id }) => id === "agent-payment-boundary-review",
  );

  assert.ok(sample, "expected the Agent Payment Boundary Review sample");
  assert.ok(markdown, "expected the Markdown Boundary Review sample");
  assert.equal(sample.kind, "agent-payment-boundary-review");
  assert.equal(sample.demonstration, true);
  assert.equal(sample.securityCertification, false);
  assert.equal(sample.reviewSubject.ownedByReviewer, true);
  assert.deepEqual(sample.reviewSubject.publicDocuments, [
    `${siteBase}.well-known/sentinel-agent.json`,
    `${siteBase}service-payment.json`,
  ]);
  assert.ok(sample.findings.length >= 6);
  assert.ok(sample.findings.some(({ status }) => status === "clear"));
  assert.ok(sample.findings.some(({ status }) => status === "ambiguous"));
  assert.ok(sample.findings.some(({ status }) => status === "missing"));
  assert.equal(
    sample.findings.find(({ id }) => id === "ABR-003").evidence.jsonPointer,
    "/authorization",
  );
  assert.ok(
    sample.findings.every(
      ({ id, boundary, evidence, status, risk, correction }) =>
        id && boundary && evidence?.documentUrl && evidence?.jsonPointer &&
        ["clear", "ambiguous", "missing"].includes(status) && risk && correction,
    ),
  );
  assert.match(sample.disclaimer, /demonstration/i);
  assert.match(sample.disclaimer, /not a security certification/i);
  assert.match(markdown, /# Sentinel Agent Payment Boundary Review/);
  assert.match(markdown, /## Findings matrix/);
  assert.match(
    markdown,
    new RegExp(sample.reviewedAtUtc.replaceAll(".", "\\.")),
  );
  assert.match(markdown, /Ambiguous/);
  assert.match(markdown, /Missing/);
  assert.equal(offer.sampleUrl, sampleUrl);
  assert.equal(
    offer.sampleMarkdownUrl,
    sampleMarkdownUrl,
  );
  assert.equal(manifest.interfaces.sampleAgentPaymentBoundaryReview, sampleUrl);
  assert.match(
    html,
    /href="\/sample-agent-payment-boundary-review\.json"[^>]*>View sample Boundary Review<\/a>/i,
  );
  assert.match(
    html,
    /href="\/sample-agent-payment-boundary-review\.md"[^>]*>Read Markdown sample<\/a>/i,
  );
  for (const document of [guide, llms, readme]) {
    assert.match(document, new RegExp(sampleUrl.replaceAll(".", "\\.")));
  }
  assert.match(
    readme,
    new RegExp(sampleMarkdownUrl.replaceAll(".", "\\.")),
  );
});

test("publishes an executable quote-first service request contract", async () => {
  const request = await readJson("public/service-request.json");

  assert.ok(request, "expected public/service-request.json to exist");
  assert.equal(request.transport.method, "email");
  assert.equal(request.transport.to, "sentinel@genesysx.org");
  assert.deepEqual(request.requestSchema.required, [
    "serviceId",
    "requestTransport",
  ]);
  assert.deepEqual(request.requestSchema.properties.requestTransport.enum, [
    "email",
    "github-issue",
  ]);
  assert.equal(request.requestSchema.properties.chainId.const, 1);
  assert.deepEqual(request.requestSchema.properties.serviceId.enum, [
    "agent-payment-boundary-review",
    "claimant-context-intake",
    "evidence-preview",
    "trace-snapshot",
  ]);
  assert.equal(
    request.requestSchema.properties.transactionHash.pattern,
    "^0x[0-9a-fA-F]{64}$",
  );
  assert.match(request.transport.bodyTemplate, /Service ID: \{serviceId\}/);
  assert.match(
    request.transport.bodyTemplate,
    /Ethereum Mainnet transaction hash \(case services\): \{transactionHash\}/,
  );
  assert.match(request.transport.bodyTemplate, /Reply email: \{replyEmail\}/);
  assert.match(request.transport.bodyTemplate, /Request transport: \{requestTransport\}/);
  assert.match(request.transport.bodyTemplate, /quote request only/i);
  assert.match(request.transport.bodyTemplate, /do not.*pay.*complete written quote/i);
  assert.equal(request.workflow.completeQuoteRequiredBeforePayment, true);
  assert.equal(request.workflow.paymentAllowedBeforeCompleteQuote, false);
  assert.equal(
    request.workflow.quoteContract,
    `${siteBase}service-payment.json`,
  );
  assert.equal(request.safety.publicFactsOnly, true);
  assert.ok(request.safety.forbiddenInputs.includes("private keys"));
  assert.ok(request.safety.forbiddenInputs.includes("wallet signatures"));
  const caseCondition = request.requestSchema.allOf.find((rule) =>
    rule.if?.properties?.serviceId?.enum?.includes("evidence-preview"),
  );
  assert.ok(caseCondition, "expected case-service conditional inputs");
  assert.deepEqual(caseCondition.then.required, ["chainId", "transactionHash"]);
  const emailCondition = request.requestSchema.allOf.find(
    (rule) => rule.if?.properties?.requestTransport?.const === "email",
  );
  assert.ok(emailCondition, "expected email-specific reply address requirement");
  assert.deepEqual(emailCondition.then.required, ["replyEmail"]);
});

test("renders an email-independent copy fallback from the request contract", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /Copy complete request/i);
  assert.match(html, /Agent-ready request packet/i);
  assert.match(html, /Service ID: evidence-preview/i);
  assert.match(html, /Reply email:/i);
  assert.match(html, /href="\/service-request\.json"/i);

  const pageSource = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(
    pageSource,
    /import serviceRequest from "\.\.\/public\/service-request\.json"/,
  );
});

test("publishes a public GitHub issue transport for quote requests", async () => {
  const [response, request, template, services, manifest] = await Promise.all([
    render(),
    readJson("public/service-request.json"),
    readText(".github/ISSUE_TEMPLATE/service-request.yml"),
    readJson("public/services.json"),
    readJson("public/.well-known/sentinel-agent.json"),
  ]);
  const html = await response.text();
  const githubTransport = request.alternateTransports.find(
    ({ id }) => id === "github-issue",
  );

  assert.deepEqual(githubTransport, {
    id: "github-issue",
    method: "github-issue",
    visibility: "public",
    repository: "TerminallyLazy/sentinel-recovery-support",
    newIssueUrl:
      "https://github.com/TerminallyLazy/sentinel-recovery-support/issues/new?template=service-request.yml",
    apiEndpoint:
      "https://api.github.com/repos/TerminallyLazy/sentinel-recovery-support/issues",
    templatePath: ".github/ISSUE_TEMPLATE/service-request.yml",
    titleTemplate: "Sentinel quote request: {serviceId}",
    bodyTemplate:
      "Sentinel Recovery service request\nService ID: {serviceId}\nRequest transport: github-issue\nNetwork: Ethereum Mainnet (chain ID {chainId})\nEthereum Mainnet transaction hash (case services): {transactionHash}\nPublic manifest URL(s) (agent review): {publicDocumentUrls}\nSpecific question or intended use (optional): {intendedUse}\nPreferred output format (optional — HTML or Markdown): {preferredFormat}\nTiming need (optional): {timingNeed}\n\nThis is a quote request only. It moves no funds and authorizes no payment. Do not begin work or pay until Sentinel replies in this issue with a complete written quote.\nThis issue is public. Do not include identity documents, confidential material, credentials, private keys, seed phrases, wallet signatures, or wallet connections.",
    authentication: "requester-owned-github-credential",
    sentinelRequestsCredential: false,
    responseChannel: "created-issue",
  });
  assert.match(html, /Open public GitHub request/i);
  assert.match(
    html,
    /github\.com\/TerminallyLazy\/sentinel-recovery-support\/issues\/new\?template=service-request\.yml&amp;title=Sentinel%20quote%20request%3A%20agent-payment-boundary-review/i,
  );
  assert.match(html, /GitHub quote requests are public/i);
  assert.match(
    html,
    /Email or a GitHub reply cannot change the recipient/i,
  );
  assert.match(template, /^name: Service quote request/m);
  assert.match(template, /id: service_id/);
  assert.match(template, /Agent Payment Boundary Review \(\$49\)/);
  assert.match(template, /public facts only/i);
  assert.match(template, /request moves no funds and authorizes no payment/i);
  assert.match(template, /complete written quote.*before.*payment/i);
  assert.match(
    services.requestProcess[0],
    /email or a public GitHub issue/i,
  );
  assert.equal(
    manifest.capabilities.find(({ id }) => id === "request_paid_evidence_service")
      .alternateTransports[0].method,
    "github-issue",
  );
});

test("keeps a service request non-financial until a complete quote", async () => {
  const request = await readJson("public/service-request.json");

  assert.ok(request.authorization, "expected explicit request authorization");
  assert.equal(request.authorization.agentMayDraft, true);
  assert.equal(
    request.authorization.agentMaySendOnlyWithinDelegatedCommunicationAuthority,
    true,
  );
  assert.equal(request.authorization.requestMovesFunds, false);
  assert.equal(request.authorization.requestAuthorizesPayment, false);
  assert.equal(request.safety.requestCreatesServiceEntitlement, false);
  assert.equal(request.safety.paymentInstructionsIncluded, false);
  assert.equal(
    request.safety.writtenEmailCannotChangeCanonicalPaymentTuple,
    true,
  );
});

test("publishes an inspectable Evidence Preview sample before payment", async () => {
  const [response, sample, services, markdown] = await Promise.all([
    render(),
    readJson("public/sample-evidence-preview.json"),
    readJson("public/services.json"),
    readFile(new URL("public/sample-evidence-preview.md", root), "utf8"),
  ]);
  const html = await response.text();

  assert.match(html, /See the evidence before you pay/i);
  assert.match(html, /href="#sample-preview"[^>]*>View sample Evidence Preview<\/a>/i);
  assert.match(
    html,
    /0x9cd477a715e8af4b3d10cc74abc578d395e86c7d3c0747157b1fc14d975b44bf/i,
  );
  assert.match(html, new RegExp(sample.observation.blockHash, "i"));
  assert.match(html, new RegExp(sample.generatedAtUtc.replaceAll(".", "\\.")));
  const pageSource = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(
    pageSource,
    /className="sample-request-link"\s+href=\{serviceRequestUrl\("Evidence Preview", "evidence-preview"\)\}/,
  );
  assert.ok(sample);
  assert.equal(sample.demonstration, true);
  assert.equal(sample.observation.network, "ethereum-mainnet");
  assert.equal(sample.observation.chainId, 1);
  assert.equal(sample.transaction.status, "success");
  assert.equal(sample.observation.blockNumber, 25_498_695);
  assert.equal(
    sample.recipientState.observedAtBlockNumber,
    sample.observation.blockNumber,
  );
  assert.equal(
    sample.recipientState.observedAtBlockHash,
    sample.observation.blockHash,
  );
  assert.equal(sample.recipientState.bytecodeObservation, "no-bytecode-observed");
  assert.deepEqual(sample.recipientState.stateRead, {
    balanceMethod: "eth_getBalance",
    codeMethod: "eth_getCode",
    blockParameter: {
      blockHash: sample.observation.blockHash,
      requireCanonical: true,
    },
  });
  assert.match(sample.sources.block, new RegExp(sample.observation.blockHash));
  assert.match(sample.disclaimer, /not a customer case/i);
  assert.match(sample.recommendedNextStep, /No further paid work is recommended/i);
  assert.ok(sample.explicitUnknowns.length >= 4);
  assert.doesNotMatch(JSON.stringify(sample), /@|confidence|recoveryProbability/i);
  assert.match(markdown, /# Sentinel Evidence Preview/);
  assert.match(markdown, /## Explicit unknowns/);
  const preview = services.offerings.find(({ id }) => id === "evidence-preview");
  assert.equal(preview.sampleUrl, `${siteBase}sample-evidence-preview.json`);
});

test("publishes independently verifiable paid-service and privacy contracts", async () => {
  const [manifest, payment, privacy] = await Promise.all([
    readJson("public/.well-known/sentinel-agent.json"),
    readJson("public/service-payment.json"),
    readJson("public/privacy.json"),
  ]);

  assert.ok(manifest);
  assert.ok(payment);
  assert.ok(privacy);
  assert.equal(payment.network.chainId, 1);
  assert.equal(payment.recipient.address, supportWallet);
  assert.equal(payment.verification.writtenEmailCannotChangeRecipient, true);
  assert.equal(payment.authorization.autonomousAgentPaymentAllowed, true);
  assert.equal(
    payment.authorization.payerAgentMaySendWithinDelegatedAuthority,
    true,
  );
  assert.equal(payment.authorization.payerAgentMustFollowOwnPolicy, true);
  assert.equal(payment.authorization.recipientHumanAcceptanceRequired, false);
  assert.equal(payment.authorization.inboundReceiptMayBeObservedAutomatically, true);
  assert.equal(
    payment.authorization.outboundWalletActionRequiresHumanAuthorization,
    true,
  );
  assert.equal(payment.quote.maxValidityDays, 7);
  assert.deepEqual(payment.quote.requiredFields, [
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
    "cancellationAndRefundTerms"
  ]);
  assert.equal(privacy.collection.identityDocumentsRequested, false);
  assert.equal(privacy.collection.contextFieldsOptional, true);
  assert.equal(privacy.retention.unpaidInquiryDaysAfterClosure, 30);
  assert.equal(privacy.retention.paidServiceRecordDaysAfterDelivery, 90);
  assert.equal(
    manifest.safety.voluntarySupportCreatesServiceEntitlement,
    false,
  );
  assert.equal("createsServiceEntitlement" in manifest.safety, false);
  const paidCapability = manifest.capabilities.find(
    ({ id }) => id === "request_paid_evidence_service",
  );
  assert.ok(paidCapability);
  assert.equal(paidCapability.movesFunds, false);
  assert.equal(paidCapability.payerHumanReviewRequired, false);
  assert.equal(
    paidCapability.payerAgentMaySendWithinDelegatedAuthority,
    true,
  );
});

test("gates Pages deployment and avoids a generated Pages Router directory", async () => {
  const [workflow, exportScript, cleanScript, gitignore] = await Promise.all([
    readFile(new URL(".github/workflows/deploy-pages.yml", root), "utf8"),
    readFile(new URL("scripts/export-pages.mjs", root), "utf8"),
    readFile(new URL("scripts/clean-pages.mjs", root), "utf8"),
    readFile(new URL(".gitignore", root), "utf8"),
  ]);

  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /--directory \.pages-artifact/);
  assert.match(exportScript, /path\.join\(root, "\.pages-artifact"\)/);
  assert.match(exportScript, /JSON\.parse/);
  assert.match(exportScript, /service-request\.json/);
  assert.ok(
    (exportScript.match(/sample-agent-payment-boundary-review\.json/g) ?? [])
      .length >= 3,
    "expected the Pages exporter to rewrite, require, and JSON-validate the Boundary Review sample",
  );
  assert.ok(
    (exportScript.match(/sample-agent-payment-boundary-review\.md/g) ?? [])
      .length >= 2,
    "expected the Pages exporter to rewrite and require the Markdown Boundary Review sample",
  );
  assert.match(cleanScript, /\.pages-artifact/);
  assert.match(gitignore, /^\/\.pages-artifact\/$/m);
});
