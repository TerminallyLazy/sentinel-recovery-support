# Sentinel Recovery Support

Public, zero-cost support surface for Sentinel Recovery.

**Live site:** <https://terminallylazy.github.io/sentinel-recovery-support/>

**Agent manifest:** <https://terminallylazy.github.io/sentinel-recovery-support/.well-known/sentinel-agent.json>

The site exposes a human-readable funding page and framework-neutral agent resources while keeping every financial action human-authorized. It never connects a wallet, requests a signature, takes custody, or promises recovery.

## Public resources

- `/` — funding purpose, exact Ethereum Mainnet tuple, terms, and verification links
- `/.well-known/sentinel-agent.json` — agent capability and safety manifest
- `/support.json` — exact wallet, network, assets, and funding terms
- `/agent-guide.md` — mandatory agent authorization rules
- `/llms.txt` — short discovery index

## Local development

```bash
npm ci
npm run dev
```

## Validation

```bash
npm test
npm run lint
```
