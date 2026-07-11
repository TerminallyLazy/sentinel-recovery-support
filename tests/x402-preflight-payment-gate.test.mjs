import assert from "node:assert/strict";
import test from "node:test";

const moduleUrl = new URL("../worker/x402-preflight-app.mjs", import.meta.url);
const routeUrl =
  "https://sentinel.example/api/x402/v1/preflight/payment-required";

async function loadPaymentGate() {
  try {
    return await import(moduleUrl.href);
  } catch (error) {
    assert.fail(
      `x402 payment gate module must exist: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

test("returns x402 v2 Base Sepolia payment requirements before running the preflight", async () => {
  const { createX402PreflightApp } = await loadPaymentGate();
  const facilitatorClient = {
    async getSupported() {
      return {
        kinds: [
          {
            x402Version: 2,
            scheme: "exact",
            network: "eip155:84532",
          },
        ],
        extensions: [],
        signers: {},
      };
    },
    async verify() {
      assert.fail("an unpaid request must not be verified");
    },
    async settle() {
      assert.fail("an unpaid request must not be settled");
    },
  };
  const app = createX402PreflightApp({ facilitatorClient });
  const response = await app.fetch(
    new Request(routeUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ x402Version: 2 }),
    }),
  );
  const paymentRequiredHeader = response.headers.get("payment-required");
  const paymentRequired = JSON.parse(
    Buffer.from(paymentRequiredHeader, "base64").toString("utf8"),
  );

  assert.equal(response.status, 402);
  assert.equal(paymentRequired.x402Version, 2);
  assert.equal(paymentRequired.accepts.length, 1);
  assert.equal(paymentRequired.accepts[0].scheme, "exact");
  assert.equal(paymentRequired.accepts[0].network, "eip155:84532");
  assert.equal(paymentRequired.accepts[0].amount, "10000");
  assert.equal(
    paymentRequired.accepts[0].payTo,
    "0x91bdE13382c3Ee082EE42a147DF54f6A6129a412",
  );
  assert.equal(
    paymentRequired.accepts[0].asset,
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  );
  assert.ok(paymentRequiredHeader);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});
