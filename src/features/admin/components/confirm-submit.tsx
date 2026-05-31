"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ConfirmSubmitProps = {
  /** Trigger button label (sits in the table row). */
  label: string;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

/**
 * Gates a server-action form submit behind a confirmation modal. Drop it
 * INSIDE a `<form action={serverAction}>` — on confirm it calls
 * `form.requestSubmit()`, so the existing server action runs unchanged.
 */
export function ConfirmSubmit({
  label,
  title,
  message,
  confirmLabel = "Remove",
  danger = true,
}: ConfirmSubmitProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [open]);

  function confirm() {
    const form = triggerRef.current?.closest("form");
    setOpen(false);
    form?.requestSubmit();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn("iv-linkbtn", danger && "iv-linkbtn--danger")}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>

      {open ? (
        <div
          className="iv-confirm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="iv-confirm" role="dialog" aria-modal="true">
            <h3 className="iv-confirm__title">{title}</h3>
            <p className="iv-confirm__msg">{message}</p>
            <div className="iv-confirm__actions">
              <button type="button" className="btn btn-stroke btn-sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={cn("btn btn-sm", danger ? "btn-red" : "btn-white")}
                onClick={confirm}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
