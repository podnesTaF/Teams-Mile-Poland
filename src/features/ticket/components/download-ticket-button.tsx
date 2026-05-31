"use client";

/**
 * Triggers the browser print dialog, which lets the runner save the ticket
 * as a PDF (or print it). The `@media print` styles in landing.css isolate
 * the white ticket card so the output is a clean, standalone ticket.
 */
export function DownloadTicketButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn btn-red iv-no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
