import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "pages");
const basePath = "/sentinel-recovery-support";

const { default: worker } = await import(
  new URL(`../dist/server/index.js?export=${Date.now()}`, import.meta.url)
);

const response = await worker.fetch(
  new Request("https://terminallylazy.github.io/", {
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

if (!response.ok) {
  throw new Error(`Static render failed with HTTP ${response.status}`);
}

let html = await response.text();

for (const prefix of [
  "/assets/",
  "/.well-known/",
  "/agent-guide.md",
  "/llms.txt",
  "/support.json",
  "/support-intent.json",
  "/impact.json",
  "/robots.txt",
]) {
  html = html.replaceAll(`\"${prefix}`, `\"${basePath}${prefix}`);
  html = html.replaceAll(`url(${prefix}`, `url(${basePath}${prefix}`);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "dist/client"), output, { recursive: true });
await rm(path.join(output, ".vite"), { recursive: true, force: true });
await rm(path.join(output, ".assetsignore"), { force: true });
await rm(path.join(output, "_headers"), { force: true });
await writeFile(path.join(output, "index.html"), html);
await writeFile(path.join(output, "404.html"), html);
await writeFile(path.join(output, ".nojekyll"), "");

const exported = await readFile(path.join(output, "index.html"), "utf8");

for (const required of [
  `${basePath}/assets/`,
  `${basePath}/.well-known/sentinel-agent.json`,
  `${basePath}/agent-guide.md`,
  `${basePath}/support-intent.json`,
  `${basePath}/impact.json`,
  "0x91bdE13382c3Ee082EE42a147DF54f6A6129a412",
  "NO RECOVERY GUARANTEE",
]) {
  if (!exported.includes(required)) {
    throw new Error(`Static export is missing: ${required}`);
  }
}

console.log(`Exported GitHub Pages bundle to ${output}`);
