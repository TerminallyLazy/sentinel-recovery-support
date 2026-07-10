# Sentinel paid-service operations

This is a human-operated checklist. Nothing here signs, broadcasts, spends,
withdraws, or moves funds from Sentinel's receiving wallet.

1. Validate the public request against `public/service-request.json`. Reject
   confidential data, credentials, `PaymentPayload`, signature headers, keys,
   wallet connections, unsupported formats, or incomplete inputs.
2. Save the valid request JSON outside the repository. Run the local
   approval-gated `npm run quote:prepare` command documented in `README.md`.
   This creates mode-`0600` JSON and Markdown quote artifacts and appends the
   exact JSON digest to the local approved-quote registry.
3. Inspect both artifacts and compare the JSON raw-byte SHA-256 with the Markdown
   digest. Reply manually through the same email thread or public GitHub issue
   that carried the request. Deliver the exact byte-for-byte JSON file and its
   Markdown summary together. Do not reformat, copy, paste, or reserialize the
   JSON after approval. Do not publish a
   quote through automation. The Markdown is not a standalone payable quote;
   the requester must verify its JSON SHA-256, that Sentinel controls the reply
   source, and that the JSON matches the canonical payment contract.
4. Record the reply URL or email message identifier in the local case notes.
   Do not place private email content or live quote artifacts in this public
   repository.
5. After the requester returns a transaction hash with the quote ID, run the
   read-only `npm run receipt:verify` command with the local approved-quote
   registry and receipt ledger. Do not start work for pending, rejected, or
   manual-review results.
6. A first exact receipt is credited once. A repeated check of the same quote
   is idempotent; a receipt reused for another quote routes to manual review.
7. Deliver only the fixed scope stated in the approved quote. Never interpret
   receipt verification as payer identity, payer authority, payment intent,
   recovery eligibility, or permission for an outbound wallet action.

Paid-service quotes currently support canonical USDC and canonical USDT on
Ethereum Mainnet. ETH remains a voluntary-support asset and is not used for
USD-denominated service quotes.
