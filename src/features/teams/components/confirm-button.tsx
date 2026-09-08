"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A destructive button with a confirm step (#62): leave, remove, hand over,
 * dissolve.
 *
 * The admin side already has `features/admin/components/confirm-submit.tsx`,
 * but that one gates a `<form action={serverAction}>` submit and hard-codes its
 * English chrome. The team pages call their actions through `useTransition`
 * and are translated, so this is the same `.iv-confirm-*` vocabulary driven by
 * an `onConfirm` callback instead. Only the dialog markup is shared; keeping
 * them as two files is what avoids bending the admin one out of shape.
 */
export function ConfirmButton({
  label,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled = false,
  variant = "link",
  /** Value for `data-roster-action` on the trigger — the HTTP probe's marker. */
  action,
  /** Optional `data-roster-target` (the member the action is aimed at). */
  target,
}: {
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** `link` sits inline in a roster row; `button` is a standalone action. */
  variant?: "link" | "button";
  action: string;
  target?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [open]);

  // Closing before the action runs: the transition re-renders the roster, and a
  // dialog left open over a row that no longer exists is a dead end.
  function confirm() {
    setOpen(false);
    onConfirm();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={
          variant === "button" ? "btn btn-stroke-dark btn-sm" : cn("iv-linkbtn", "iv-linkbtn--danger")
        }
        onClick={() => setOpen(true)}
        disabled={disabled}
        data-roster-action={action}
        data-roster-target={target}
      >
        {label}
      </button>

      {open ? (
        <div
          className="iv-confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="iv-confirm"
            role="dialog"
            aria-modal="true"
            data-roster-confirm={action}
          >
            <h3 className="iv-confirm__title">{title}</h3>
            <p className="iv-confirm__msg">{message}</p>
            <div className="iv-confirm__actions">
              <button
                type="button"
                className="btn btn-stroke btn-sm"
                onClick={() => setOpen(false)}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="btn btn-red btn-sm"
                onClick={confirm}
                data-roster-confirm-ok={action}
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
