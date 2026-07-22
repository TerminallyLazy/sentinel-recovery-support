"use client";

import { useState, type MouseEvent } from "react";

const RELEASE_BLOCKER_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSforl4TZfhhn9YJXSydD32bNtEPjdte32ckhaogksosbQ9OIQ/viewform";
const REQUEST_REFERENCE_ENTRY = "entry.2082650723";

function createRequestReference() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `SRQ-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formUrlFor(reference: string) {
  const url = new URL(RELEASE_BLOCKER_FORM_URL);
  url.searchParams.set("usp", "pp_url");
  url.searchParams.set(REQUEST_REFERENCE_ENTRY, reference);
  return url.toString();
}

export function ReleaseBlockerIntake() {
  const [requestReference, setRequestReference] = useState<string | null>(null);
  const [requestFormUrl, setRequestFormUrl] = useState(
    RELEASE_BLOCKER_FORM_URL,
  );

  const prepareRequest = (event: MouseEvent<HTMLAnchorElement>) => {
    const reference = createRequestReference();
    const url = formUrlFor(reference);

    event.currentTarget.href = url;
    setRequestReference(reference);
    setRequestFormUrl(url);
  };

  return (
    <div className="release-intake">
      <a
        className="release-intake-cta"
        href={requestFormUrl}
        onClick={prepareRequest}
        rel="noreferrer"
        target="_blank"
      >
        Start the no-login $750 request
      </a>
      {requestReference ? (
        <p className="release-intake-reference" aria-live="polite">
          Request reference prepared: <code>{requestReference}</code>. It is
          prefilled in the form.
        </p>
      ) : null}
      <p className="release-intake-note">
        Opens a Google Form that does not require sign-in. Google processes the
        public URLs, reply email, and optional failure summary you submit. A
        request moves no funds, authorizes no payment, and starts no work.
      </p>
    </div>
  );
}
