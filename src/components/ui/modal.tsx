"use client";

import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { IconBack, IconClose } from "./icons";

type ModalSize = "" | "sm" | "md" | "lg";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  soft?: boolean;
  labelledBy?: string;
  showLogo?: boolean;
  bgImage?: string;
};

/**
 * Brand-aware dialog. Esc + overlay click close it; body scroll is locked
 * via `body.modal-open`. All visual variants (`soft`, `size`, `bgImage`)
 * are CSS-driven — see `.modal*` rules in globals.css.
 */
export function Modal({
  open,
  onClose,
  onBack,
  icon,
  children,
  size = "",
  soft = false,
  labelledBy,
  showLogo = true,
  bgImage,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
    };
  }, [open, onClose]);

  if (!open) return null;

  const style = bgImage
    ? ({ "--modal-bg-image": `url(${bgImage})` } as React.CSSProperties)
    : undefined;

  return (
    <div
      className="modal-overlay"
      style={style}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {showLogo ? (
        <div className="modal-overlay-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ace-battle.svg" alt="ACE BATTLE" />
        </div>
      ) : null}
      <button className="modal-close" onClick={onClose} aria-label="Close">
        <IconClose />
      </button>
      <div
        className={cn("modal", size && `modal-${size}`, soft && "modal-soft")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {onBack ? (
          <button className="modal-back" onClick={onBack} aria-label="Back">
            <IconBack />
          </button>
        ) : null}
        {icon ? <span className="modal-icon">{icon}</span> : null}
        {children}
      </div>
    </div>
  );
}

type ModalHeadProps = {
  title: ReactNode;
  sub?: ReactNode;
  subTag?: ReactNode;
  id?: string;
  titleSize?: "sm";
  titleClassName?: string;
};

export function ModalHead({ title, sub, subTag, id, titleSize, titleClassName }: ModalHeadProps) {
  return (
    <div className="modal-head">
      <h3
        id={id}
        className={cn("modal-title", titleSize === "sm" && "modal-title-sm", titleClassName)}
      >
        {title}
      </h3>
      {subTag ? <p className="modal-sub-tag">{subTag}</p> : null}
      {sub ? <p className="modal-sub">{sub}</p> : null}
    </div>
  );
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="modal-body">{children}</div>;
}

export function ModalFoot({ children }: { children: ReactNode }) {
  return <div className="modal-foot">{children}</div>;
}
