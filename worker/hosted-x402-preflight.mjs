import { preflightX402V2PaymentRequired } from "../mcp/x402-payment-required.mjs";
import {
  MAX_PREFLIGHT_BYTES,
  PreflightInputError,
} from "../mcp/preflight.mjs";

const RESPONSE_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
});
const HOSTED_PREFLIGHT_PATH = "/api/x402/v1/preflight/payment-required";

export function matchesHostedX402PreflightRoute(url) {
  return url.pathname === HOSTED_PREFLIGHT_PATH;
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...RESPONSE_HEADERS, ...headers },
  });
}

async function readBoundedUtf8Body(request) {
  if (request.body === null) {
    return { content: "", tooLarge: false };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      content += decoder.decode();
      return { content, tooLarge: false };
    }
    bytesRead += value.byteLength;
    if (bytesRead > MAX_PREFLIGHT_BYTES) {
      await reader.cancel("payload-too-large");
      return { content: "", tooLarge: true };
    }
    content += decoder.decode(value, { stream: true });
  }
}

export async function handleHostedX402Preflight(request) {
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "method-not-allowed" },
      { status: 405, headers: { allow: "POST" } },
    );
  }

  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return jsonResponse(
      { error: "unsupported-media-type" },
      { status: 415 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PREFLIGHT_BYTES
  ) {
    return jsonResponse({ error: "payload-too-large" }, { status: 413 });
  }

  let body;
  try {
    body = await readBoundedUtf8Body(request);
  } catch (error) {
    if (error instanceof TypeError) {
      return jsonResponse({ error: "invalid-input" }, { status: 400 });
    }
    throw error;
  }
  if (body.tooLarge) {
    return jsonResponse({ error: "payload-too-large" }, { status: 413 });
  }

  const { content } = body;
  let result;
  try {
    result = preflightX402V2PaymentRequired({
      document: {
        name: "document-1",
        content,
      },
    });
  } catch (error) {
    if (error instanceof PreflightInputError) {
      return jsonResponse({ error: "invalid-input" }, { status: 400 });
    }
    throw error;
  }

  return jsonResponse(result);
}
