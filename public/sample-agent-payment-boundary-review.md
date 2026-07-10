# Sentinel Agent Payment Boundary Review — sample

This is a public format demonstration performed on Sentinel Recovery Support's own documents. It is not a security certification, legal opinion, wallet audit, or guarantee that an agent or payment implementation is safe.

Reviewed at: `2026-07-10T06:43:22Z`

## Review subject

- Documents reviewed: [Sentinel agent manifest](https://terminallylazy.github.io/sentinel-recovery-support/.well-known/sentinel-agent.json) and [service payment contract](https://terminallylazy.github.io/sentinel-recovery-support/service-payment.json)
- Public documents: 2
- Private systems, code execution, and wallet control: not reviewed

## Findings matrix

| ID | Boundary | Status | Evidence | Risk | Prioritized correction |
| --- | --- | --- | --- | --- | --- |
| ABR-001 | A service request does not move funds | Clear | Agent manifest `/capabilities/1/movesFunds` | Low — the request capability is explicitly non-financial. | Keep the boolean adjacent to the request contract. |
| ABR-002 | Payer policy remains the source of payment authority | Clear | Payment contract `/authorization/payerAgentMustFollowOwnPolicy` | Low — Sentinel metadata does not replace the payer's policy. | Preserve this rule across every payment surface. |
| ABR-003 | Recipient agents cannot use outbound wallet authority | Clear | Payment contract `/authorization` | Low — recipient-agent signing and broadcasting are separately denied. | Keep the rule direction-specific. |
| ABR-004 | Recipient, chain, and asset contracts are canonical | Clear | Payment contract `/verification` | Low — email cannot change the canonical payment tuple. | Require tuple verification immediately before payment. |
| ABR-005 | Autonomous payment eligibility is quote-specific | Clear | Payment contract `/authorization/autonomousPayment` | Low — eligibility requires a complete unexpired quote and payer-policy approval of the exact tuple; metadata expands no authority. | Keep the complete-quote and exact-policy bindings. |
| ABR-006 | Quote and receipt identities are replay-resistant and idempotent | Clear | Payment contract `/reconciliation` | Low — identifiers are unique immutable UUIDs, payment references are single-use, and native or ERC-20 receipt identities are unique across quotes. | Bind each on-chain receipt to at most one quote and never auto-credit duplicates. |
| ABR-007 | Metadata has verifiable freshness and integrity | Clear | Payment contract `/integrity` | Low — publication time, a raw-byte SHA-256 sidecar, and source history are available for independent pinning. | Regenerate and verify the digest on every contract change. |
| ABR-008 | Receipt verification has explicit failure states | Clear | Payment contract `/reconciliation/receiptStates` | Low — deterministic states and reason codes keep exceptional receipts on a manual-review path. | Preserve manual review for late, duplicate, partial, excess, reorg, or conflicting evidence. |

## Maintenance checks

1. Keep autonomous payment eligibility bound to the complete unexpired quote and the payer's own policy.
2. Regenerate the raw-byte SHA-256 sidecar whenever the payment contract changes.
3. Preserve unique on-chain receipt identity, deterministic receipt states, and manual review for duplicate, late, partial, or excess payments.

The full machine-readable demonstration is available at [sample-agent-payment-boundary-review.json](https://terminallylazy.github.io/sentinel-recovery-support/sample-agent-payment-boundary-review.json).
