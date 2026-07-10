import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifact = path.join(root, ".pages-artifact");
const basePath = "/sentinel-recovery-support";
const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff2", "font/woff2"],
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (url.pathname === "/") {
    response.writeHead(302, { location: `${basePath}/` });
    response.end();
    return;
  }

  if (!url.pathname.startsWith(`${basePath}/`)) {
    response.writeHead(404).end("Not found");
    return;
  }

  const relative = decodeURIComponent(url.pathname.slice(basePath.length + 1));
  let target = path.resolve(artifact, relative || "index.html");

  if (!target.startsWith(`${artifact}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    if ((await stat(target)).isDirectory()) {
      target = path.join(target, "index.html");
    }

    const body = await readFile(target);
    const contentType = contentTypes.get(path.extname(target)) ?? "application/octet-stream";
    response.writeHead(200, { "content-type": contentType }).end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Preview: http://${host}:${port}${basePath}/`);
});
