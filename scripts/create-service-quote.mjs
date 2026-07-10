#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { createServiceQuote } from "./lib/service-quote.mjs";

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("arguments must be supplied as --name value pairs");
    }
    values[key.slice(2)] = value;
  }
  return values;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

try {
  const args = parseArguments(process.argv.slice(2));
  if (!args.request) {
    throw new Error("--request is required");
  }

  const [request, services, paymentContract] = await Promise.all([
    readJson(args.request),
    readJson(new URL("../public/services.json", import.meta.url)),
    readJson(new URL("../public/service-payment.json", import.meta.url)),
  ]);

  const quote = createServiceQuote({
    request,
    services,
    paymentContract,
    assetSymbol: args.asset,
    amountBaseUnits: args["amount-base-units"],
    quoteId: args["quote-id"],
    paymentReference: args["payment-reference"],
    issuedAt: args["issued-at"],
    expiresAt: args["expires-at"],
  });

  process.stdout.write(`${JSON.stringify(quote, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`Unable to create quote: ${error.message}\n`);
  process.exitCode = 1;
}
