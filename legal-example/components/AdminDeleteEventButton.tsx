"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminDeleteEventButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Usunąć ten dzień wydarzenia? Tej operacji nie można cofnąć.")) {
      return;
    }
    setBusy(true);
    await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="text-xs font-semibold text-brand-error underline decoration-dotted underline-offset-4 disabled:opacity-50"
    >
      {busy ? "…" : "Usuń"}
    </button>
  );
}
