# Sentinel Recovery MCP resources

Source-only, read-only stdio MCP adapter for Sentinel Recovery's public service
catalog and quote-request contract.

This package is not published to npm or the MCP Registry yet. Run it from a
verified repository checkout. The GitHub Pages site is static and is not a
remote MCP endpoint.

## Resources

- `sentinel://services/catalog` reads and validates the live `services.json`.
- `sentinel://services/quote-request-contract` reads and validates the live
  `service-request.json`.

There are no MCP tools. A resource read moves no funds. It submits no quote
request, authorizes no payment, and creates no service entitlement. The server
never requests credentials, keys, signatures, wallet connections, custody, or
wallet control.

## Install and verify

From the repository root:

```bash
npm ci --prefix mcp --ignore-scripts
npm test --prefix mcp
npm audit --prefix mcp --audit-level=high
npm run pack:check --prefix mcp
```

## Client configuration

Replace the example path with the absolute path to the verified checkout:

```json
{
  "mcpServers": {
    "sentinel-recovery-services": {
      "command": "node",
      "args": ["/absolute/path/to/sentinel-recovery-support/mcp/server.mjs"]
    }
  }
}
```

The client launches `node mcp/server.mjs` over stdio. The server writes only MCP
protocol messages to stdout; startup failures go to stderr.

## Network and validation boundaries

- Only the two hard-coded canonical HTTPS URLs are fetched.
- Requests use `GET`, a ten-second timeout, and a 256 KiB response cap.
- Responses must be JSON objects matching the expected minimal contract shape.
- An upstream failure returns an actionable MCP error with the canonical URL.
- No environment variables, API keys, install scripts, or wallet access are
  required.

The package is `UNLICENSED` because this repository does not currently publish a
general code license. Installing or running the source does not grant any
financial authority.
