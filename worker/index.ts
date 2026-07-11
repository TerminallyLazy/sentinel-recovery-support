/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { matchesHostedX402PreflightRoute } from "./hosted-x402-preflight.mjs";
import { createX402PreflightApp } from "./x402-preflight-app.mjs";

let x402PreflightApp: ReturnType<typeof createX402PreflightApp> | undefined;
const imageOutputFormats = new Set([
  "image/jpeg",
  "image/avif",
  "image/webp",
  "image/png",
  "image/gif",
] as const);
type ImageOutputFormat =
  | "image/jpeg"
  | "image/avif"
  | "image/webp"
  | "image/png"
  | "image/gif";

function isImageOutputFormat(value: string): value is ImageOutputFormat {
  return imageOutputFormats.has(value as ImageOutputFormat);
}

function getX402PreflightApp() {
  x402PreflightApp ??= createX402PreflightApp();
  return x402PreflightApp;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          if (!isImageOutputFormat(format)) {
            throw new Error("Unsupported image output format.");
          }
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (matchesHostedX402PreflightRoute(url)) {
      return getX402PreflightApp().fetch(request, env, ctx);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
