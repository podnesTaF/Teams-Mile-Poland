"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Prominent, copyable team invite link for the dashboard share panel.
 * The URL is pre-computed server-side (so it's correct in SSR), and the
 * Copy button writes it to the clipboard with a transient "Copied" state.
 */
export function InviteLink({
  url,
  copyLabel,
  copiedLabel,
}: {
  url: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    try {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can fail in non-secure contexts; ignore.
    }
  }

  return (
    <div className="iv-invite">
      <span className="iv-invite__url">{url}</span>
      <button type="button" className={cn("iv-invite__copy", copied && "is-copied")} onClick={copy}>
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
