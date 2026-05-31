"use client";

import { useState } from "react";

/**
 * Copies the team's invite link (`<origin>/join/CODE`) to the clipboard.
 * Origin is read on the client so it works on any host.
 */
export function CopyLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${encodeURIComponent(code)}`
        : `/join/${encodeURIComponent(code)}`;
    try {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in non-secure contexts; ignore.
    }
  }

  return (
    <button type="button" className="iv-linkbtn" onClick={copy}>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
