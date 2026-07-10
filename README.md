# Sentinel Recovery Support

Public support and fixed-scope Ethereum evidence-service surface for Sentinel Recovery.

**Live site:** <https://terminallylazy.github.io/sentinel-recovery-support/>

**Paid services:** <https://terminallylazy.github.io/sentinel-recovery-support/#services>

**Agent manifest:** <https://terminallylazy.github.io/sentinel-recovery-support/.well-known/sentinel-agent.json>

The site exposes a human-readable funding page, `$49/$99/$199` public-data services, and framework-neutral agent resources. A payer agent may send within its own delegated financial policy, and inbound receipts need no recipient-side human acceptance. Every outbound action from Sentinel's receiving wallet requires human authorization. Sentinel never takes custody, requests private keys or signature material, or promises recovery.

## Public resources

- `/` — funding purpose, exact Ethereum Mainnet tuple, terms, and verification links
- `/.well-known/sentinel-agent.json` — agent capability and safety manifest
- `/support.json` — exact wallet, network, assets, and funding terms
- `/support-intent.json` — direction-specific payer and receiving-wallet policy
- `/services.json` — fixed-price scope, deliverable, and turnaround catalog
- `/service-request.json` — canonical agent input schema, email and public GitHub issue transports, and copyable quote-request template: <https://terminallylazy.github.io/sentinel-recovery-support/service-request.json>
- `/sample-agent-payment-boundary-review.json` and `.md` — inspectable `$49` self-review demonstration: [JSON](https://terminallylazy.github.io/sentinel-recovery-support/sample-agent-payment-boundary-review.json), [Markdown](https://terminallylazy.github.io/sentinel-recovery-support/sample-agent-payment-boundary-review.md)
- `/sample-evidence-preview.json` and `.md` — inspectable `$99` format demonstration
- `/service-payment.json` — canonical recipient, assets, quote fields, and verification rules
- `/privacy.json` — minimal inputs, optional context, retention, and do-not-send rules
- `/agent-guide.md` — mandatory agent authority boundaries
- `/impact.json` — historical receipt and contribution-funded-work snapshot
- `/llms.txt` — short discovery index
- `mcp/` — read-only stdio MCP server with deterministic agent-payment and x402 `PaymentRequired` preflights plus the live service and quote-request resources; install from source or the checksummed [`v0.3.0` GitHub Release](https://github.com/TerminallyLazy/sentinel-recovery-support/releases/tag/v0.3.0), not from the static Pages site

## Local MCP preflight and resources

The MCP server exposes two deterministic read-only tools:

- `preflight_agent_payment_boundary` — checks one or two inline public
  documents against 11 fixed payment-authority boundaries, without fetching
  requester URLs, executing supplied text, submitting a request, or moving
  funds
- `preflight_x402_v2_payment_required` — checks one decoded inline x402 v2
  `PaymentRequired` JSON document under a pinned, closed-world exact-EVM
  EIP-3009 Sentinel safety profile, without decoding headers, evaluating payer
  policy, verifying signatures or receipts, settling, connecting a wallet, or
  moving funds

It also exposes exactly two read-only resources:

- `sentinel://services/catalog`
- `sentinel://services/quote-request-contract`

Only resource reads fetch the two hard-coded canonical live JSON contracts.
Both preflights run locally on inline content and make no network request. Neither
path can submit a request, move funds, authorize payment, request credentials,
connect a wallet, or perform wallet actions.

The checksummed `v0.3.0` MCPB and its SHA-256 sidecar are published on the
[GitHub Release](https://github.com/TerminallyLazy/sentinel-recovery-support/releases/tag/v0.3.0).
The official MCP Registry lists version `0.3.0` as active and latest under
`io.github.TerminallyLazy/sentinel-recovery-services`; verify the exact
[Registry record](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.TerminallyLazy%2Fsentinel-recovery-services/versions/0.3.0)
before relying on availability.

Install and verify it from the repository root:

```bash
npm ci --prefix mcp --ignore-scripts
npm test --prefix mcp
npm audit --prefix mcp --audit-level=high
npm run pack:check --prefix mcp
```

Configure an MCP client to launch the source checkout over stdio, replacing the
path with the absolute path on that machine:

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

Direct launch uses `node mcp/server.mjs`. Do not configure the GitHub Pages URL
as an MCP endpoint: the static site does not implement Streamable HTTP. The npm
package is not published yet, so no `npx` installation is advertised.

## Local development

```bash
npm ci
npm run dev
```

To inspect the exact GitHub Pages artifact at its production base path:

```bash
npm run preview:pages
```

## Validation

```bash
npm test
npm run lint
npm audit --audit-level=high
npm run export:pages
```
