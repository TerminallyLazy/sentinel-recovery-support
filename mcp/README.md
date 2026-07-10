# Sentinel Agent Payment Boundary Preflight

Read-only stdio MCP server with a deterministic free preflight for public agent
and payment documents, plus Sentinel Recovery's public service catalog and
quote-request contract.

Version `0.2.0` is published as a checksummed MCPB on the
[GitHub Release](https://github.com/TerminallyLazy/sentinel-recovery-support/releases/tag/v0.2.0).
It is not published to npm. Registry metadata is present in `server.json`, but
Registry availability remains unverified until the public Registry API returns
the exact namespace and version. The GitHub Pages site is static and is not a
remote MCP endpoint.

## Tool

- `preflight_agent_payment_boundary` analyzes one or two inline public JSON,
  Markdown, or text documents, with a 100 KiB combined limit.
- It performs 11 fixed checks covering request-versus-payment authority, payer
  policy, inbound versus outbound wallet authority, custody/signing/spending,
  the canonical payment tuple, quote expiry, replay handling, receipt states,
  sensitive wallet inputs, donation separation, and metadata integrity.
- Findings are deterministic `clear`, `ambiguous`, or `missing` results with a
  bounded locator, normalized evidence marker, risk, and correction. Supplied
  prose is never copied into model-visible output.
- It does not fetch requester-controlled URLs, execute document content, submit
  a request, connect a wallet, or move funds.
- `clear` means the required recognized structured declarations are present
  and no unmodeled supplied content was observed; it is not a certification
  and does not verify implementation behavior. For every check that can clear,
  an unknown field or non-allowlisted free-form value conservatively downgrades
  the declaration to `ambiguous` instead of guessing whether it is safe.
  External digest URLs remain
  `ambiguous` because the offline preflight does not fetch or trust them; the
  full review can verify supplied integrity evidence separately.

## Resources

- `sentinel://services/catalog` reads and validates the live `services.json`.
- `sentinel://services/quote-request-contract` reads and validates the live
  `service-request.json`.

A resource read or preflight moves no funds. It submits no quote request,
authorizes no payment, and creates no service entitlement. The server never
requests credentials, keys, signatures, wallet connections, custody, or wallet
control. An optional `$49` review is quote-first; using the free tool does not
create a payment obligation.

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
- The preflight tool accepts inline content only and makes no network requests.
- JSON with duplicate object keys is rejected before evaluation; recognized
  fields and containers must match their bounded types and value domains.
- Requests use `GET`, a ten-second timeout, and a 256 KiB response cap.
- Responses must be JSON objects matching the expected minimal contract shape.
- An upstream failure returns an actionable MCP error with the canonical URL.
- No environment variables, API keys, install scripts, or wallet access are
  required.

The package is `UNLICENSED` because this repository does not currently publish a
general code license. Installing or running the source does not grant any
financial authority.
