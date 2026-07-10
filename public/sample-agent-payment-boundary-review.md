# Sentinel Agent Payment Boundary Review — sample

This is a public format demonstration performed on Sentinel Recovery Support's own documents. It is not a security certification, legal opinion, wallet audit, or guarantee that an agent or payment implementation is safe.

Reviewed at: `2026-07-10T03:54:00Z`

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
| ABR-005 | Autonomous payment eligibility is quote-specific | Ambiguous | Payment contract `/authorization/autonomousAgentPaymentAllowed` | Medium — a global `true` can look like blanket authority. | Require payer-policy approval of the full quote tuple. |
| ABR-006 | Quote identity is replay-resistant and idempotent | Missing | Payment contract `/quote/requiredFields` | Medium — uniqueness and replay handling are not defined. | Define quote and reference formats plus duplicate, late, partial, and overpayment handling. |
| ABR-007 | Metadata has verifiable freshness and integrity | Missing | Payment contract `/schemaVersion` | Medium — no timestamp, content digest, or signed version binding is published. | Add publication time, content digest, and an optional signature or pinned commit. |
| ABR-008 | Receipt verification has explicit failure states | Ambiguous | Payment contract `/verification/returnTransactionHashWithQuoteIdForManualReceiptVerification` | Medium — reorg, timeout, wrong-asset, wrong-chain, and insufficient-amount states are not enumerated. | Publish deterministic pending, verified, rejected, and manual-review states. |

## Priority corrections

1. Scope autonomous payment permission to the complete quote and the payer's own policy decision.
2. Define quote replay, duplicate, late, partial, and overpayment handling.
3. Add version freshness and integrity fields plus deterministic receipt-verification states.

The full machine-readable demonstration is available at [sample-agent-payment-boundary-review.json](https://terminallylazy.github.io/sentinel-recovery-support/sample-agent-payment-boundary-review.json).
