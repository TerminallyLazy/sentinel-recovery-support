import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../worker/hosted-x402-preflight.mjs", import.meta.url);
const maxPreflightBytes = 100 * 1024;

const validPaymentRequired = {
  x402Version: 2,
  resource: {
    url: "https://example.com/agent-evidence",
    description: "Deterministic agent-payment evidence",
    mimeType: "application/json",
  },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:84532",
      amount: "10000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x91bdE13382c3Ee082EE42a147DF54f6A6129a412",
      maxTimeoutSeconds: 60,
      extra: {
        assetTransferMethod: "eip3009",
        name: "USDC",
        version: "2",
      },
    },
  ],
};

async function loadHostedPreflight() {
  try {
    return await import(moduleUrl.href);
  } catch (error) {
    assert.fail(
      `hosted x402 preflight module must exist: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

test("returns the deterministic x402 preflight for one bounded JSON POST", async () => {
  const { handleHostedX402Preflight } = await loadHostedPreflight();
  const request = new Request(
    "https://sentinel.example/api/x402/v1/preflight/payment-required",
    {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(validPaymentRequired),
    },
  );

  const response = await handleHostedX402Preflight(request);
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(result.kind, "x402-v2-payment-required-preflight");
  assert.equal(result.scope.networkRequests, false);
  assert.equal(result.scope.walletAccess, false);
  assert.equal(result.summary.clear, 8);
  assert.equal(result.summary.ambiguous, 1);
  assert.equal(result.summary.missing, 0);
});

test("rejects methods other than POST without reading a body", async () => {
  const { handleHostedX402Preflight } = await loadHostedPreflight();
  const response = await handleHostedX402Preflight(
    new Request(
      "https://sentinel.example/api/x402/v1/preflight/payment-required",
      { method: "GET" },
    ),
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(await response.json(), {
    error: "method-not-allowed",
  });
});

test("rejects a POST whose media type is not application/json", async () => {
  const { handleHostedX402Preflight } = await loadHostedPreflight();
  const response = await handleHostedX402Preflight(
    new Request(
      "https://sentinel.example/api/x402/v1/preflight/payment-required",
      {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(validPaymentRequired),
      },
    ),
  );

  assert.equal(response.status, 415);
  assert.deepEqual(await response.json(), {
    error: "unsupported-media-type",
  });
});

test("returns a controlled error for invalid JSON without echoing input", async () => {
  const { handleHostedX402Preflight } = await loadHostedPreflight();
  const attackerInput = '{"secret":"do-not-echo"';
  const response = await handleHostedX402Preflight(
    new Request(
      "https://sentinel.example/api/x402/v1/preflight/payment-required",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: attackerInput,
      },
    ),
  );
  const body = await response.text();

  assert.equal(response.status, 400);
  assert.equal(body.includes("do-not-echo"), false);
  assert.deepEqual(JSON.parse(body), { error: "invalid-input" });
});

test("rejects a declared oversized body before parsing", async () => {
  const { handleHostedX402Preflight } = await loadHostedPreflight();
  const response = await handleHostedX402Preflight(
    new Request(
      "https://sentinel.example/api/x402/v1/preflight/payment-required",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(maxPreflightBytes + 1),
        },
        body: "{}",
      },
    ),
  );

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "payload-too-large" });
});

test("stops an undeclared streamed body at the byte limit", async () => {
  const { handleHostedX402Preflight } = await loadHostedPreflight();
  const oversizedBody = JSON.stringify({
    padding: "x".repeat(maxPreflightBytes),
  });
  const response = await handleHostedX402Preflight(
    new Request(
      "https://sentinel.example/api/x402/v1/preflight/payment-required",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: oversizedBody,
      },
    ),
  );

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "payload-too-large" });
});

test("matches only the versioned hosted preflight pathname", async () => {
  const { matchesHostedX402PreflightRoute } = await loadHostedPreflight();

  assert.equal(
    matchesHostedX402PreflightRoute(
      new URL(
        "https://sentinel.example/api/x402/v1/preflight/payment-required?ignored=1",
      ),
    ),
    true,
  );
  assert.equal(
    matchesHostedX402PreflightRoute(
      new URL("https://sentinel.example/api/x402/v1/preflight/payment-required/"),
    ),
    false,
  );
  assert.equal(
    matchesHostedX402PreflightRoute(
      new URL("https://sentinel.example/api/x402/v1/preflight"),
    ),
    false,
  );
});
