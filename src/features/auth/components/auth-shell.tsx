"use client";

import { useEffect, type ReactNode } from "react";

import { useRouter } from "@/i18n/navigation";
import { IconClose } from "@/components/ui/icons";

/**
 * Modal presentation for the auth cards. Rendered by the `@modal` intercepting
 * routes over the landing, mirroring how the registration modal works. Esc and
 * overlay-click close it back to the landing; body scroll is locked.
 */
export function AuthModalShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push("/");
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [router]);

  return (
    <div
      className="auth-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.push("/");
      }}
    >
      <div className="ace-landing" style={{ position: "relative", width: "min(560px, 100%)", display: "flex", justifyContent: "center" }}>
        <div className="auth-glow" />
        <button
          type="button"
          className="modal-close"
          onClick={() => router.push("/")}
          aria-label="Close"
        >
          <IconClose />
        </button>
        {children}
      </div>
    </div>
  );
}

/**
 * Full-page presentation for the auth cards — the hard-load fallback served by
 * the real `/auth/*` routes when there's no landing to intercept over.
 */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="ace-landing">
      <div className="auth-wrap">
        <div className="auth-glow" />
        {children}
      </div>
    </div>
  );
}

/** Google "G" mark used on the OAuth button. */
export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.3 13.2 17.6 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.3h12.4c-.5 2.9-2.1 5.3-4.6 7l7.2 5.6c4.2-3.9 6.6-9.6 6.6-16.3z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.2-8.7 2.2-6.4 0-11.7-3.7-13.6-9.9l-7.9 6.1C6.4 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
