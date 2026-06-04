"use client";

import { DEFAULT_PHONE_PREFIX, formatPhone, isPhoneEmpty } from "@/lib/phone";

import { FloatField } from "./float-field";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
};

/**
 * Phone input with a masked, Polish-defaulted format ("+48 512 345 678").
 * Prefills the dial code on focus and clears back to empty on blur if the
 * user never entered a national number, so the placeholder label reappears.
 */
export function PhoneField({ label, value, onChange, error, className }: Props) {
  return (
    <FloatField
      label={label}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={value}
      error={error}
      className={className}
      onFocus={() => {
        if (!value) onChange(DEFAULT_PHONE_PREFIX);
      }}
      onBlur={() => {
        if (isPhoneEmpty(value)) onChange("");
      }}
      onChange={(event) => onChange(formatPhone(event.target.value))}
    />
  );
}
