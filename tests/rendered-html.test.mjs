import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

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
