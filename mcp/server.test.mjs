import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import {
  MAX_RESOURCE_BYTES,
  RESOURCE_DEFINITIONS,
  createSentinelServer,
} from "./server.mjs";

const servicesFixture = {
  schemaVersion: "1.0.0",
  offerings: [
    {
      id: "agent-payment-boundary-review",
      priceUsd: 49,
    },
  ],
};

const requestFixture = {
  schemaVersion: "1.0.0",
  requestSchema: {
    required: ["serviceId", "requestTransport"],
  },
  workflow: {
    completeQuoteRequiredBeforePayment: true,
  },
};

function createFetchRouter(responses) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const response = responses.get(url);
    if (response instanceof Error) {
      throw response;
    }
    if (!response) {
      return new Response("not found", { status: 404 });
    }
    return response;
  };
  return { calls, fetchImpl };
}

function jsonResponse(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...init.headers },
    ...init,
  });
}

async function connectClient(fetchImpl) {
  const server = createSentinelServer({ fetchImpl });
  const client = new Client({ name: "sentinel-mcp-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

test("advertises exactly two read-only contract resources and no tools", async (t) => {
  const { fetchImpl } = createFetchRouter(new Map());
  const { client } = await connectClient(fetchImpl);
  t.after(() => client.close());

  assert.equal(client.getServerVersion()?.name, "sentinel-recovery-mcp-server");
  assert.ok(client.getServerCapabilities()?.resources);
  assert.equal(client.getServerCapabilities()?.tools, undefined);
  assert.match(client.getInstructions() ?? "", /read-only/i);
  assert.match(client.getInstructions() ?? "", /moves no funds/i);
  assert.match(client.getInstructions() ?? "", /authorizes no payment/i);

  const listed = await client.listResources();
  assert.deepEqual(
    listed.resources.map(({ uri, name, mimeType }) => ({ uri, name, mimeType })),
    RESOURCE_DEFINITIONS.map(({ uri, name }) => ({
      uri,
      name,
      mimeType: "application/json",
    })),
  );
});

test("reads and validates the canonical service contracts", async (t) => {
  const responses = new Map([
    [RESOURCE_DEFINITIONS[0].sourceUrl, jsonResponse(servicesFixture)],
    [RESOURCE_DEFINITIONS[1].sourceUrl, jsonResponse(requestFixture)],
  ]);
  const { calls, fetchImpl } = createFetchRouter(responses);
  const { client } = await connectClient(fetchImpl);
  t.after(() => client.close());

  const serviceResult = await client.readResource({
    uri: RESOURCE_DEFINITIONS[0].uri,
  });
  const requestResult = await client.readResource({
    uri: RESOURCE_DEFINITIONS[1].uri,
  });

  assert.deepEqual(JSON.parse(serviceResult.contents[0].text), servicesFixture);
  assert.deepEqual(JSON.parse(requestResult.contents[0].text), requestFixture);
  assert.equal(serviceResult.contents[0].uri, RESOURCE_DEFINITIONS[0].uri);
  assert.equal(requestResult.contents[0].uri, RESOURCE_DEFINITIONS[1].uri);
  assert.deepEqual(
    calls.map(({ url }) => url),
    RESOURCE_DEFINITIONS.map(({ sourceUrl }) => sourceUrl),
  );
  assert.ok(calls.every(({ init }) => init.method === "GET"));
  assert.ok(
    calls.every(
      ({ init }) => init.headers?.accept === "application/json",
    ),
  );
  assert.ok(calls.every(({ init }) => init.signal instanceof AbortSignal));
});

test("returns actionable MCP errors for unavailable or invalid upstream data", async (t) => {
  const responses = new Map([
    [
      RESOURCE_DEFINITIONS[0].sourceUrl,
      new Response("temporarily unavailable", { status: 503 }),
    ],
    [
      RESOURCE_DEFINITIONS[1].sourceUrl,
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ],
  ]);
  const { fetchImpl } = createFetchRouter(responses);
  const { client } = await connectClient(fetchImpl);
  t.after(() => client.close());

  await assert.rejects(
    client.readResource({ uri: RESOURCE_DEFINITIONS[0].uri }),
    (error) => {
      assert.match(error.message, /HTTP 503.*Retry later/i);
      assert.doesNotMatch(
        error.message,
        /MCP error -32603: MCP error -32603:/,
      );
      return true;
    },
  );
  await assert.rejects(
    client.readResource({ uri: RESOURCE_DEFINITIONS[1].uri }),
    /valid JSON.*canonical URL/i,
  );
});

test("rejects JSON objects that do not match the declared contract shape", async (t) => {
  const responses = new Map([
    [RESOURCE_DEFINITIONS[0].sourceUrl, jsonResponse({ unexpected: true })],
    [RESOURCE_DEFINITIONS[1].sourceUrl, jsonResponse({ unexpected: true })],
  ]);
  const { fetchImpl } = createFetchRouter(responses);
  const { client } = await connectClient(fetchImpl);
  t.after(() => client.close());

  await assert.rejects(
    client.readResource({ uri: RESOURCE_DEFINITIONS[0].uri }),
    /does not match the Sentinel service catalog contract/i,
  );
  await assert.rejects(
    client.readResource({ uri: RESOURCE_DEFINITIONS[1].uri }),
    /does not match the Sentinel quote-request contract/i,
  );
});

test("rejects oversized resource responses before reading their bodies", async (t) => {
  const responses = new Map([
    [
      RESOURCE_DEFINITIONS[0].sourceUrl,
      new Response("{}", {
        status: 200,
        headers: {
          "content-length": String(MAX_RESOURCE_BYTES + 1),
          "content-type": "application/json",
        },
      }),
    ],
  ]);
  const { fetchImpl } = createFetchRouter(responses);
  const { client } = await connectClient(fetchImpl);
  t.after(() => client.close());

  await assert.rejects(
    client.readResource({ uri: RESOURCE_DEFINITIONS[0].uri }),
    new RegExp(`exceeds ${MAX_RESOURCE_BYTES} bytes`, "i"),
  );
});

test("cancels a chunked response as soon as its body exceeds the cap", async (t) => {
  let arrayBufferCalled = false;
  let cancelled = false;
  let readCount = 0;
  const chunks = [
    new Uint8Array(MAX_RESOURCE_BYTES),
    new Uint8Array([0]),
  ];
  const chunkedResponse = {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    body: {
      getReader() {
        return {
          async read() {
            const value = chunks[readCount];
            readCount += 1;
            return value ? { done: false, value } : { done: true };
          },
          async cancel() {
            cancelled = true;
          },
        };
      },
    },
    async arrayBuffer() {
      arrayBufferCalled = true;
      return new Uint8Array(MAX_RESOURCE_BYTES + 1).buffer;
    },
  };
  const responses = new Map([
    [RESOURCE_DEFINITIONS[0].sourceUrl, chunkedResponse],
  ]);
  const { fetchImpl } = createFetchRouter(responses);
  const { client } = await connectClient(fetchImpl);
  t.after(() => client.close());

  await assert.rejects(
    client.readResource({ uri: RESOURCE_DEFINITIONS[0].uri }),
    new RegExp(`exceeds ${MAX_RESOURCE_BYTES} bytes`, "i"),
  );
  assert.equal(arrayBufferCalled, false);
  assert.equal(cancelled, true);
  assert.equal(readCount, 2);
});

test("rejects unknown resource URIs", async (t) => {
  const { fetchImpl } = createFetchRouter(new Map());
  const { client } = await connectClient(fetchImpl);
  t.after(() => client.close());

  await assert.rejects(
    client.readResource({ uri: "sentinel://services/unknown" }),
    /Resource sentinel:\/\/services\/unknown not found/,
  );
});
