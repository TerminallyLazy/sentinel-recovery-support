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
