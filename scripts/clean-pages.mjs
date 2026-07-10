import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Only remove Sentinel's hidden generated deployment artifact. A `pages/`
// directory may contain user-authored source and must never be deleted here.
await rm(path.join(root, ".pages-artifact"), { recursive: true, force: true });
