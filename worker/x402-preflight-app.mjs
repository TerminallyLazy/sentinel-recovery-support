import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { Hono } from "hono";

import { handleHostedX402Preflight } from "./hosted-x402-preflight.mjs";

const ROUTE_PATH = "/api/x402/v1/preflight/payment-required";
const ROUTE_KEY = `POST ${ROUTE_PATH}`;
const BASE_SEPOLIA = "eip155:84532";
const PAY_TO = "0x91bdE13382c3Ee082EE42a147DF54f6A6129a412";
const TESTNET_FACILITATOR_URL = "https://x402.org/facilitator";

export function createX402PreflightApp({
  facilitatorClient = new HTTPFacilitatorClient({
    url: TESTNET_FACILITATOR_URL,
  }),
  syncFacilitatorOnStart = true,
} = {}) {
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    BASE_SEPOLIA,
    new ExactEvmScheme(),
  );
  const app = new Hono();

  app.use("*", async (context, next) => {
    await next();
    context.header("cache-control", "no-store");
    context.header("x-content-type-options", "nosniff");
  });

  app.use(
    paymentMiddleware(
      {
        [ROUTE_KEY]: {
          accepts: {
            scheme: "exact",
            price: "$0.01",
            network: BASE_SEPOLIA,
            payTo: PAY_TO,
            maxTimeoutSeconds: 60,
          },
          description:
            "Deterministic x402 v2 exact-EVM EIP-3009 PaymentRequired preflight",
          mimeType: "application/json",
        },
      },
      resourceServer,
      undefined,
      undefined,
      syncFacilitatorOnStart,
    ),
  );

  app.post(ROUTE_PATH, (context) =>
    handleHostedX402Preflight(context.req.raw),
  );

  return app;
}
