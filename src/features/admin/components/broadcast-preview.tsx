"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { previewBroadcastEmailAction } from "@/features/event-mailings/user-broadcast-actions";

type PreviewLocale = "en" | "pl" | "ua";

const LOCALE_LABEL: Record<PreviewLocale, string> = {
  en: "English",
  pl: "Polski",
  ua: "Українська",
};

type ModalState = {
  mailLocale: PreviewLocale;
  html?: string;
  subject?: string;
  usedFallback?: boolean;
  error?: string;
};

/**
 * Per-language "Preview" buttons for a broadcast compose form. Drop it INSIDE
 * the `<form>`: on click it reads the form's current subject/body fields (the
 * same names the send action reads), asks the server to render the real email
 * template through the same variant pick delivery uses, and shows the result
 * in a modal iframe — so the preview is the send, minus the sending.
 */
export function BroadcastPreview({
  locale,
  withUnsubscribe,
  mailLocales,
}: {
  /** Admin UI locale, forwarded for the action's auth gate. */
  locale: string;
  /** Whether the previewed email carries the opt-out footer (user broadcasts do). */
  withUnsubscribe: boolean;
  /** Which languages to offer preview buttons for. */
  mailLocales: PreviewLocale[];
}) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [isPending, startTransition] = useTransition();
  const anchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [modal]);

  function openPreview(mailLocale: PreviewLocale) {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) ?? "");
    setModal({ mailLocale });
    startTransition(async () => {
      const r = await previewBroadcastEmailAction({
        locale,
        mailLocale,
        subject: field("subject"),
        bodyHtml: field("body"),
        subjectPl: field("subject_pl"),
        bodyHtmlPl: field("body_pl"),
        subjectUa: field("subject_ua"),
        bodyHtmlUa: field("body_ua"),
        withUnsubscribe,
      });
      setModal((m) =>
        m && m.mailLocale === mailLocale ? { mailLocale, ...r } : m,
      );
    });
  }

  return (
    <>
      <span
        ref={anchorRef}
        style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
      >
        <span className="iv-note" style={{ margin: 0 }}>
          Preview:
        </span>
        {mailLocales.map((l) => (
          <button key={l} type="button" className="iv-linkbtn" onClick={() => openPreview(l)}>
            {LOCALE_LABEL[l]}
          </button>
        ))}
      </span>

      {modal ? (
        <div
          className="iv-confirm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className="iv-confirm"
            role="dialog"
            aria-modal="true"
            style={{ width: "min(720px, 96vw)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}
          >
            <h3 className="iv-confirm__title">Email preview — {LOCALE_LABEL[modal.mailLocale]}</h3>
            {isPending && !modal.html && !modal.error ? (
              <p className="iv-confirm__msg">Rendering…</p>
            ) : modal.error ? (
              <p className="iv-confirm__msg">{modal.error}</p>
            ) : (
              <>
                {modal.usedFallback ? (
                  <p className="iv-confirm__msg" style={{ margin: "8px 0 0" }}>
                    No {LOCALE_LABEL[modal.mailLocale]} version written — these recipients get
                    the default version shown below.
                  </p>
                ) : null}
                <p className="iv-confirm__msg" style={{ margin: "8px 0 0" }}>
                  Subject: <strong>{modal.subject}</strong>
                </p>
                <iframe
                  title="Broadcast email preview"
                  sandbox=""
                  srcDoc={modal.html}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    flex: 1,
                    minHeight: "55vh",
                    border: "1px solid rgba(255, 255, 255, 0.14)",
                    borderRadius: 8,
                    background: "#ffffff",
                  }}
                />
              </>
            )}
            <div className="iv-confirm__actions">
              <button type="button" className="btn btn-stroke btn-sm" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
