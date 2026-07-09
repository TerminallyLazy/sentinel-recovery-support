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
  assert.match(html, /<title>Support Sentinel Recovery<\/title>/i);
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
});

test("removes starter artifacts and publishes agent discovery files", async () => {
  await assert.rejects(access(new URL("app/_sites-preview", root)));

  const [manifest, support, guide, llms, packageJson] = await Promise.all([
    readFile(new URL("public/.well-known/sentinel-agent.json", root), "utf8"),
    readFile(new URL("public/support.json", root), "utf8"),
    readFile(new URL("public/agent-guide.md", root), "utf8"),
    readFile(new URL("public/llms.txt", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(manifest, /explicit-human-authorization/);
  assert.match(manifest, /91bdE13382c3Ee082EE42a147DF54f6A6129a412/);
  assert.match(support, /A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/);
  assert.match(support, /dAC17F958D2ee523a2206206994597C13D831ec7/);
  assert.match(guide, /Never send funds autonomously/);
  assert.match(llms, /Voluntary Ethereum Mainnet support/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
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
    impactReceipts: `${siteBase}impact.json`,
  });
  assert.match(guide, new RegExp(`${siteBase}support\\.json`));
  assert.match(llms, new RegExp(`${siteBase}support-intent\\.json`));
  assert.doesNotMatch(guide, /\]\(\/(?:\.well-known|agent-guide|llms|support)/);
  assert.doesNotMatch(llms, /\]\(\/(?:\.well-known|agent-guide|llms|support)/);
});

test("publishes a human-authorized support intent", async () => {
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
  assert.equal(intent.payment.fees.estimateBeforeAuthorization, true);
  assert.equal(intent.authorization.requiredAtActionTime, true);
  assert.equal(intent.authorization.autonomousExecutionAllowed, false);
  assert.equal(intent.authorization.agentMayOpenWallet, false);
  assert.equal(intent.authorization.agentMaySign, false);
  assert.equal(intent.authorization.agentMayBroadcast, false);
  assert.equal(intent.authorization.agentMaySendFunds, false);
  assert.equal(intent.terms.createsServiceEntitlement, false);
  assert.equal(intent.terms.guaranteesRecovery, false);
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
