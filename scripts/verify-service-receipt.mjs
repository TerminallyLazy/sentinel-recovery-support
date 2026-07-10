#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  reconcileReceipt,
  requireApprovedQuote,
} from "./lib/local-reconciliation.mjs";
import { verifyServiceReceipt } from "./lib/service-receipt.mjs";

const MAX_RPC_RESPONSE_BYTES = 1_000_000;

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

async function readLimitedBody(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RPC_RESPONSE_BYTES) {
    throw new Error("RPC response exceeded the 1 MB safety limit");
  }
  if (!response.body) return "";

  const chunks = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RPC_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("RPC response exceeded the 1 MB safety limit");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function validateRpcUrl(value) {
  const url = new URL(value);
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("RPC URL must use HTTPS, except for a loopback test endpoint");
  }
  return url;
}

function createRpcClient(rpcUrl) {
  let id = 0;
  return async (method, params) => {
    const response = await fetch(rpcUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    if (!response.ok) {
      throw new Error(`RPC returned HTTP ${response.status}`);
    }
    const text = await readLimitedBody(response);
    const payload = JSON.parse(text);
    if (payload.error) {
      throw new Error(`RPC error ${payload.error.code}: ${payload.error.message}`);
    }
    return payload.result;
  };
}

try {
  const args = parseArguments(process.argv.slice(2));
  if (
    !args.quote ||
    !args["quote-registry"] ||
    !args["receipt-ledger"] ||
    !args["transaction-hash"] ||
    !args["rpc-url"]
  ) {
    throw new Error(
      "--quote, --quote-registry, --receipt-ledger, --transaction-hash, and --rpc-url are required",
    );
  }
  const minimumConfirmations = Number(args.confirmations ?? "12");
  const [quoteBytes, paymentContract, services] = await Promise.all([
    readFile(args.quote),
    readJson(new URL("../public/service-payment.json", import.meta.url)),
    readJson(new URL("../public/services.json", import.meta.url)),
  ]);
  const quote = JSON.parse(quoteBytes.toString("utf8"));
  const { quoteDigest } = await requireApprovedQuote({
    registryPath: args["quote-registry"],
    quoteBytes,
    quote,
  });
  const inspection = await verifyServiceReceipt({
    quote,
    paymentContract,
    services,
    transactionHash: args["transaction-hash"],
    minimumConfirmations,
    rpc: createRpcClient(validateRpcUrl(args["rpc-url"])),
  });
  const result = await reconcileReceipt({
    ledgerPath: args["receipt-ledger"],
    quote,
    quoteDigest,
    inspection,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`Unable to verify receipt: ${error.message}\n`);
  process.exitCode = 1;
}
