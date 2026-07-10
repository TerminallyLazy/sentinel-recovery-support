#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { appendFile, readFile, rm, writeFile } from "node:fs/promises";

import { createServiceQuote } from "./lib/service-quote.mjs";
import { renderServiceQuoteMarkdown } from "./lib/service-quote-markdown.mjs";

const MAX_REQUEST_BYTES = 100_000;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

try {
  if (process.env.SENTINEL_HUMAN_APPROVAL !== "APPROVE") {
    throw new Error("explicit SENTINEL_HUMAN_APPROVAL=APPROVE is required");
  }

  const requestJson = process.env.SENTINEL_REQUEST_JSON ?? "";
  if (!requestJson || Buffer.byteLength(requestJson) > MAX_REQUEST_BYTES) {
    throw new Error("SENTINEL_REQUEST_JSON is required and must not exceed 100 KB");
  }
  const outputPath = process.env.SENTINEL_QUOTE_OUTPUT;
  if (!outputPath) {
    throw new Error("SENTINEL_QUOTE_OUTPUT is required");
  }
  const registryPath = process.env.SENTINEL_QUOTE_REGISTRY;
  if (!registryPath) {
    throw new Error("SENTINEL_QUOTE_REGISTRY is required");
  }

  const validityDays = Number(process.env.SENTINEL_VALIDITY_DAYS ?? "7");
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 7) {
    throw new Error("SENTINEL_VALIDITY_DAYS must be an integer from 1 through 7");
  }

  const [services, paymentContract] = await Promise.all([
    readJson(new URL("../public/services.json", import.meta.url)),
    readJson(new URL("../public/service-payment.json", import.meta.url)),
  ]);
  const issuedAt = new Date();
  const expiresAt = new Date(
    issuedAt.getTime() + validityDays * 24 * 60 * 60 * 1000,
  );
  const quote = createServiceQuote({
    request: JSON.parse(requestJson),
    services,
    paymentContract,
    assetSymbol: process.env.SENTINEL_ASSET,
    amountBaseUnits: process.env.SENTINEL_AMOUNT_BASE_UNITS || undefined,
    quoteId: randomUUID(),
    paymentReference: randomUUID(),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    payable: true,
  });
  const serialized = `${JSON.stringify(quote, null, 2)}\n`;
  const sha256 = createHash("sha256").update(serialized).digest("hex");
  const markdown = renderServiceQuoteMarkdown(quote, sha256);
  const markdownPath = outputPath.endsWith(".json")
    ? `${outputPath.slice(0, -5)}.md`
    : `${outputPath}.md`;
  let jsonCreated = false;
  let markdownCreated = false;

  try {
    await writeFile(outputPath, serialized, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    jsonCreated = true;
    await writeFile(markdownPath, markdown, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    markdownCreated = true;
    await appendFile(
      registryPath,
      `${JSON.stringify({
        quoteId: quote.quoteId,
        paymentReference: quote.paymentReference,
        quoteDigest: sha256,
        issuedAt: quote.issuedAt,
        expiresAt: quote.expiresAt,
      })}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  } catch (error) {
    if (jsonCreated) await rm(outputPath, { force: true });
    if (markdownCreated) await rm(markdownPath, { force: true });
    throw error;
  }
  process.stdout.write(
    `Prepared local quote artifact ${quote.quoteId} (${sha256}). No quote was issued or published.\n`,
  );
} catch (error) {
  process.stderr.write(`Unable to prepare quote artifact: ${error.message}\n`);
  process.exitCode = 1;
}
