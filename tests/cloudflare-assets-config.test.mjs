import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("routes only dynamic entry points through the Worker before static assets", async () => {
  const configUrl = new URL("../dist/server/wrangler.json", import.meta.url);
  const config = JSON.parse(await readFile(configUrl, "utf8"));

  assert.deepEqual(config.assets?.run_worker_first, [
    "/",
    "/_vinext/image",
    "/api/*",
  ]);
  assert.equal(config.assets?.binding, "ASSETS");
  assert.equal(config.assets?.directory, "../client");
});
