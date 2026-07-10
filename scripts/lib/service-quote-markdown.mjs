function formatAssetAmount(amountBaseUnits, decimals) {
  const value = amountBaseUnits.padStart(decimals + 1, "0");
  const whole = value.slice(0, -decimals);
  const fraction = value.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function renderServiceQuoteMarkdown(quote, quoteDigest) {
  const assetAmount = formatAssetAmount(
    quote.amountBaseUnits,
    quote.asset.decimals,
  );
  return `# Sentinel service quote

Status: **summary only — payable only with the exact byte-for-byte JSON quote delivered in the same Sentinel-controlled reply**

## Exact payment tuple

- Quote ID: \`${quote.quoteId}\`
- Service: \`${quote.serviceId}\`
- Price: ${assetAmount} ${quote.asset.symbol} (${quote.priceUsd} USD catalog price)
- Amount: ${Number(quote.amountBaseUnits).toLocaleString("en-US")} base units
- Network: Ethereum Mainnet / chain ID \`${quote.chainId}\`
- Asset contract: \`${quote.asset.contractAddress}\`
- Recipient: \`${quote.recipient}\`
- Payment reference: \`${quote.paymentReference}\`
- JSON quote SHA-256: \`${quoteDigest}\`
- Issued: \`${quote.issuedAt}\`
- Expires: \`${quote.expiresAt}\`

## Deliverable

${quote.deliverable}

${quote.turnaround}

## Terms and authority boundary

${quote.cancellationAndRefundTerms}

This quote does not expand the payer agent's own policy. The payer must approve the exact quote tuple under its own delegated authority. A service request moves no funds and authorizes no payment. An inbound receipt needs no recipient-side acceptance, but it does not authorize any outbound signing, broadcasting, spending, transfer, or withdrawal from Sentinel's receiving wallet.

Verify the JSON quote, its request fingerprint, the canonical service-payment contract, the selected Sentinel reply channel, and the full payment tuple immediately before paying. Never provide keys, seed phrases, signatures, wallet connections, credentials, or PaymentPayload.
`;
}
