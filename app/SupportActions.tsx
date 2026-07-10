"use client";

import { useState } from "react";
import {
  STABLECOIN_EXAMPLE_REQUESTS,
  SUPPORT_WALLET,
} from "./support-data";

type CopyState = "idle" | "copied" | "blocked";

export function CopyValue({ label, value }: { label: string; value: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const copyValue = async () => {
    setCopyState("idle");

    if (!navigator.clipboard) {
      setCopyState("blocked");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
    } catch {
      setCopyState("blocked");
    }
  };

  return (
    <span className="inline-copy">
      <button type="button" onClick={() => void copyValue()}>
        {copyState === "copied" ? `${label} copied` : `Copy ${label}`}
      </button>
      <span aria-live="polite" className="sr-only">
        {copyState === "copied"
          ? `${label} copied to the clipboard.`
          : copyState === "blocked"
            ? `Clipboard access was blocked. Select and copy the ${label} manually.`
            : ""}
      </span>
    </span>
  );
}

export function SupportActions() {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const walletUri = `ethereum:${SUPPORT_WALLET}@1`;

  const copyAddress = async () => {
    setCopyState("idle");

    if (!navigator.clipboard) {
      setCopyState("blocked");
      return;
    }

    try {
      await navigator.clipboard.writeText(SUPPORT_WALLET);
      setCopyState("copied");
    } catch {
      setCopyState("blocked");
    }
  };

  return (
    <div className="support-actions">
      <div className="wallet-block">
        <span>CONFIGURED RECEIVING ADDRESS</span>
        <code>{SUPPORT_WALLET}</code>
      </div>
      <div className="button-row">
        <button type="button" onClick={() => void copyAddress()}>
          {copyState === "copied" ? "Address copied" : "Copy address"}
        </button>
        <a href={walletUri}>Open wallet for ETH</a>
        <a
          className="secondary-action"
          href={`https://etherscan.io/address/${SUPPORT_WALLET}`}
          rel="noreferrer"
          target="_blank"
        >
          Inspect on Etherscan
        </a>
      </div>
      <div className="button-row token-request-row">
        {STABLECOIN_EXAMPLE_REQUESTS.map((request) => (
          <a href={request.uri} key={request.id}>
            Open 1 {request.asset} example
          </a>
        ))}
      </div>
      <p className="payment-request-note">
        These editable one-unit requests are examples, not minimums or service
        prices. Opening a request does not send funds. Verify every field and
        proceed only under the payer&apos;s own policy.
      </p>
      <p
        aria-live="polite"
        className={copyState === "idle" ? "sr-only" : "copy-status"}
      >
        {copyState === "copied"
          ? "The receiving address was copied to your clipboard."
          : copyState === "blocked"
            ? "Clipboard access was blocked. Select and copy the full address above."
            : ""}
      </p>
    </div>
  );
}
