import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The deployment artifact is named `pages`, which vinext would otherwise
// mistake for a Pages Router source directory on the next build.
await rm(path.join(root, "pages"), { recursive: true, force: true });
