# Sentinel Payment Preflights

Read-only stdio MCP server with two deterministic free preflights for public
payment metadata, plus Sentinel Recovery's public service catalog and
quote-request contract.

Source version `0.3.0` adds a pinned x402 v2 exact-EVM EIP-3009 safety profile.
Checksummed versioned MCPB artifacts are published on the
[GitHub Releases page](https://github.com/TerminallyLazy/sentinel-recovery-support/releases).
It is not published to npm. The official MCP Registry name is
`io.github.TerminallyLazy/sentinel-recovery-services`; verify the current
`mcp/server.json`, release checksum, and Registry record before relying on a
published version. The GitHub Pages site is static and is not a remote MCP
endpoint.

## Tools

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
- `preflight_x402_v2_payment_required` analyzes exactly one decoded inline JSON
  x402 v2 `PaymentRequired` object using nine fixed checks. It accepts only the
  pinned closed-world Sentinel profile: `exact`, canonical `eip155:<chain-id>`,
  EIP-3009 transfer metadata, 1–64 unique complete alternatives, positive
  uint256 atomic amounts, and a 1–86,400 second timeout.
- The x402 profile is intentionally stricter than core x402. A structurally
  clear result does not prove that a chain exists, a token behaves as claimed,
  an EIP-712 domain is correct, a recipient controls an address, payer policy
  authorizes a payment, a signature is valid, settlement occurred, or a receipt
  exists. Permit2, ERC-7710, nonempty extensions, and other unmodeled content are
  reported as unsupported or ambiguous, not silently accepted.

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
- Both preflight tools accept inline content only and make no network requests.
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
