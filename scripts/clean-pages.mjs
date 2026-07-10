import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Remove the legacy artifact name so vinext never mistakes it for Pages Router
// source, plus the current hidden deployment artifact before a clean build.
await rm(path.join(root, "pages"), { recursive: true, force: true });
await rm(path.join(root, ".pages-artifact"), { recursive: true, force: true });
