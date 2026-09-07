"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      const next = searchParams.get("next") || "/admin";
      router.push(next);
      router.refresh();
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4 p-8">
      <div>
        <span className="eyebrow">Panel administratora</span>
        <h1 className="mt-3 font-display text-2xl uppercase tracking-tight">
          ACE BATTLE RUN
        </h1>
        <p className="mt-2 text-sm text-brand-textMuted">
          Wpisz kod dostępu, żeby zobaczyć zgłoszenia uczestników i dokumenty
          wewnętrzne.
        </p>
      </div>

      <div>
        <label htmlFor="admin-code" className="field-label">
          Kod dostępu
        </label>
        <input
          id="admin-code"
          type="password"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="field-input"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-brand-error/40 bg-brand-error/10 p-3 text-sm text-brand-error"
        >
          Nieprawidłowy kod dostępu. Spróbuj ponownie.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || code.length === 0}
        className="btn-primary w-full"
      >
        {loading ? "Sprawdzanie…" : "Wejdź do panelu"}
      </button>
    </form>
  );
}
