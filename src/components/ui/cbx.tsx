"use client";

import { type ChangeEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type CbxProps = {
  id: string;
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
  inline?: boolean;
  className?: string;
};

/**
 * Modal-aesthetic checkbox row. The accent-red filled square is drawn by
 * the `.cbx` CSS rules in globals.css — markup stays minimal.
 */
export function Cbx({ id, checked, onChange, children, inline, className }: CbxProps) {
  return (
    <label className={cn(inline ? "cbx-inline" : "cbx", className)} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      {inline ? <span>{children}</span> : <span className="cbx-text">{children}</span>}
    </label>
  );
}
