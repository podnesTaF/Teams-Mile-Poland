"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { normalizeTeamCode } from "@/features/registration/schemas";

export function JoinCodeForm() {
  const [code, setCode] = useState("");

  return (
    <form
      className="border border-ink bg-bg p-5 md:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        const normalized = normalizeTeamCode(code);
        if (normalized) {
          window.location.assign(`/join/${encodeURIComponent(normalized)}`);
        }
      }}
    >
      <div>
        <span className="eyebrow eyebrow-red">Join a team</span>
        <h1 className="shout shout-md mt-3">Enter your code.</h1>
        <p className="mt-4 max-w-prose text-sm text-muted md:text-base">
          We will show the team before you register.
        </p>
      </div>
      <label className="mt-7 block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Team code
        </span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="WAW-WOLVES-7K2P"
          className="h-14 w-full border border-line bg-bg px-4 font-mono text-sm uppercase outline-none focus:border-ink"
        />
      </label>
      <Button type="submit" className="mt-5" block>
        Preview team
        <span aria-hidden>→</span>
      </Button>
    </form>
  );
}
