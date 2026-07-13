# Sentinel Recovery Support

Public support and fixed-scope Ethereum evidence-service surface for Sentinel Recovery.

**Live site:** <https://terminallylazy.github.io/sentinel-recovery-support/>

**Paid services:** <https://terminallylazy.github.io/sentinel-recovery-support/#services>

**Agent manifest:** <https://terminallylazy.github.io/sentinel-recovery-support/.well-known/sentinel-agent.json>

The site exposes a human-readable funding page, `$49/$99/$199` public-data services, a protocol-agnostic request-only `$1,500` 48-Hour Agent Payment Failure Reproduction Sprint, and framework-neutral agent resources. The sprint is fully asynchronous and requires no meeting or call. It uses [MatchFlight](https://terminallylazy.github.io/matchflight/) as public deterministic proof; ACH, Wise, or Zelle invoice terms, including its optional `$750` kickoff structure, are available only through a separately human-approved SOW, and the public listing contains no payment instructions or banking details. Zelle is available only after a signed SOW and invoice and buyer acknowledgement that it has no purchase protection. The sprint is not a certification or penetration test. A payer agent may send within its own delegated financial policy, and inbound receipts need no recipient-side human acceptance. Every outbound action from Sentinel's receiving wallet requires human authorization. Sentinel never takes custody, requests private keys or signature material, or promises recovery.

## Public resources

- `/` — funding purpose, exact Ethereum Mainnet tuple, terms, and verification links
- `/.well-known/sentinel-agent.json` — agent capability and safety manifest
- `/support.json` — exact wallet, network, assets, and funding terms
- `/support-intent.json` — direction-specific payer and receiving-wallet policy
- `/services.json` — fixed-price scope, deliverable, and turnaround catalog
- `/service-request.json` — canonical agent input schema, email and public GitHub issue transports, and copyable quote-request template: <https://terminallylazy.github.io/sentinel-recovery-support/service-request.json>
- `/sample-agent-payment-boundary-review.json` and `.md` — inspectable `$49` self-review demonstration: [JSON](https://terminallylazy.github.io/sentinel-recovery-support/sample-agent-payment-boundary-review.json), [Markdown](https://terminallylazy.github.io/sentinel-recovery-support/sample-agent-payment-boundary-review.md)
- [`/sample-service-quote.json`](https://terminallylazy.github.io/sentinel-recovery-support/sample-service-quote.json) — complete but expired and explicitly nonpayable quote-shape demonstration
- `/sample-evidence-preview.json` and `.md` — inspectable `$99` format demonstration
- `/service-payment.json` — canonical recipient, assets, quote fields, and verification rules
- `/privacy.json` — minimal inputs, optional context, retention, and do-not-send rules
- `/agent-guide.md` — mandatory agent authority boundaries
- `/impact.json` — historical receipt and contribution-funded-work snapshot
- `/llms.txt` — short discovery index
- `mcp/` — read-only stdio MCP server with deterministic agent-payment and x402 `PaymentRequired` preflights, a local public quote-request draft preparer, and the live service and quote-request resources; install from source or the checksummed [`v0.4.1` GitHub Release](https://github.com/TerminallyLazy/sentinel-recovery-support/releases/tag/v0.4.1), not from the static Pages site

## Local MCP preflight and resources

The source checkout is version `0.4.1` and exposes three deterministic read-only
tools:

- `preflight_agent_payment_boundary` — checks one or two inline public
  documents against 11 fixed payment-authority boundaries, without fetching
  requester URLs, executing supplied text, submitting a request, or moving
  funds
- `preflight_x402_v2_payment_required` — checks one decoded inline x402 v2
  `PaymentRequired` JSON document under a pinned, closed-world exact-EVM
  EIP-3009 Sentinel safety profile, without decoding headers, evaluating payer
  policy, verifying signatures or receipts, settling, connecting a wallet, or
  moving funds
- `prepare_agent_payment_boundary_quote_request` — prepares a complete,
  unsubmitted public GitHub issue draft for the fixed-scope Agent Payment
  Boundary Review from one or two caller-supplied public HTTPS document URLs
  without credentials, query strings, fragments, or non-public hosts; it does
  not fetch or verify those URLs, make a network request, use credentials,
  submit the issue, authorize payment, or create service entitlement

It also exposes exactly two read-only resources:

- `sentinel://services/catalog`
- `sentinel://services/quote-request-contract`

Only resource reads fetch the two hard-coded canonical live JSON contracts.
Both preflights run locally on inline content, and the request-draft preparer
formats its inputs locally without fetching supplied URLs. All three tools make
no network request and cannot submit a request, move funds, authorize payment,
request credentials, connect a wallet, or create service entitlement. The
requester decides whether to submit the public draft within its own communication
authority; a Sentinel human controls issuance of the complete written quote, and
any later payment remains controlled by the payer's own policy.

The checksummed `v0.4.1` MCPB and its SHA-256 sidecar are published on the
[GitHub Release](https://github.com/TerminallyLazy/sentinel-recovery-support/releases/tag/v0.4.1).
The official MCP Registry lists version `0.4.1` as active and latest under
`io.github.TerminallyLazy/sentinel-recovery-services`; verify the exact
[Registry record](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.TerminallyLazy%2Fsentinel-recovery-services/versions/0.4.1)
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

## Human-approved service quotes

The quote path is deliberately local and human-triggered. The
`scripts/prepare-service-quote.mjs` helper accepts public-only request JSON, but
only runs after the operator supplies `SENTINEL_HUMAN_APPROVAL=APPROVE`. It
creates a mode-`0600` local artifact for human review. It does not issue or
publish the quote, comment on an issue, request payment, or expand a payer
agent's authority. There is intentionally no public GitHub Actions quote
workflow because a live payable quote ID and payment reference should not be
exposed as a public-repository artifact.

Prepare a live local quote and append its exact digest to a local approval
registry (keep both paths outside the repository):

```bash
mkdir -p "$HOME/.local/state/sentinel-recovery"
chmod 700 "$HOME/.local/state/sentinel-recovery"
SENTINEL_HUMAN_APPROVAL=APPROVE \
SENTINEL_REQUEST_JSON="$(jq -c . /absolute/path/request.json)" \
SENTINEL_ASSET=USDC \
SENTINEL_VALIDITY_DAYS=7 \
SENTINEL_QUOTE_OUTPUT="$HOME/.local/state/sentinel-recovery/approved-quote.json" \
SENTINEL_QUOTE_REGISTRY="$HOME/.local/state/sentinel-recovery/approved-quotes.jsonl" \
npm run quote:prepare
```

The same deterministic formatter can run locally with operator-supplied UUID v4
identifiers and timestamps:

```bash
node scripts/create-service-quote.mjs \
  --request /absolute/path/request.json \
  --asset USDC \
  --quote-id 11111111-1111-4111-8111-111111111111 \
  --payment-reference 22222222-2222-4222-8222-222222222222 \
  --issued-at 2026-07-10T20:00:00.000Z \
  --expires-at 2026-07-17T20:00:00.000Z
```

Paid quotes support canonical USDC and canonical USDT only; their base-unit
amounts are derived from the fixed integer USD catalog price. ETH remains a
voluntary-support asset, not a quoted USD-denominated service asset. The raw
formatter emits a nonpayable draft to standard output so a human can inspect it.
Only the approval-gated local preparer emits a payable quote and records its
digest in the operator's approved-quote registry.

After the requester returns a transaction hash, the read-only receipt checker
can compare the confirmed canonical ERC-20 `Transfer` log to the exact approved
quote tuple and reconcile it against an append-only local receipt ledger:

```bash
node scripts/verify-service-receipt.mjs \
  --quote /absolute/path/approved-quote.json \
  --quote-registry "$HOME/.local/state/sentinel-recovery/approved-quotes.jsonl" \
  --receipt-ledger "$HOME/.local/state/sentinel-recovery/service-receipts.jsonl" \
  --transaction-hash 0x... \
  --rpc-url "$SENTINEL_ETH_RPC_URL" \
  --confirmations 12
```

Use a trusted HTTPS Ethereum Mainnet JSON-RPC endpoint and keep credentialed RPC
URLs out of issues, logs, and quote artifacts. The checker does not sign,
broadcast, spend, or move funds; it requests no keys, signatures, or wallet
connection. The local ledger makes repeated checks idempotent and routes a
receipt reused across quotes to manual review instead of crediting it twice.
The complete manual operator checklist is in
[`docs/service-operations.md`](docs/service-operations.md).

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
