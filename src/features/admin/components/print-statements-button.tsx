"use client";

import { Printer } from "lucide-react";

import { adminButton } from "./shell/admin-button";

/**
 * The one interactive control on the statements print surface: open the
 * browser's print / save-as-PDF dialog for the page as it stands.
 *
 * A client component because `window.print()` has no server equivalent, and the
 * smallest one possible — the statements themselves are server-rendered HTML, so
 * nothing about a runner's personal data reaches the browser bundle. The page is
 * printable without it (Ctrl+P prints the same sheet); this is the discoverable
 * door.
 */
export function PrintStatementsButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className={adminButton("primary")} onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
