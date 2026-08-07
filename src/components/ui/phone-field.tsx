"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { COUNTRY_OPTIONS, countryByDial, countryByIso } from "@/lib/country-calling-codes";
import {
  DEFAULT_COUNTRY_ISO,
  buildPhone,
  examplePhoneForCountry,
  formatNationalDigits,
  isPhoneEmpty,
  parsePhone,
  phoneIssue,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
  /**
   * Recolors to the house `.finput` fields (series-flows.css): "light" for the
   * auth cards, "dark" for the profile/guest forms. Default keeps the legacy
   * modal skin from globals.css.
   */
  variant?: "light" | "dark";
};

function isoForDial(dialCode: string, preferredIso?: string): string {
  if (preferredIso && countryByIso(preferredIso)?.dial === dialCode) return preferredIso;
  return countryByDial(dialCode)?.iso ?? DEFAULT_COUNTRY_ISO;
}

/**
 * Phone input with a country-code selector and a masked national number field.
 * Defaults to Poland (+48) and stores values like "+48 512 345 678".
 *
 * The mask is per-country: digits are grouped and capped the way the selected
 * country writes them (see `formatNationalDigits`), so non-digits and overlong
 * input can't be typed at all. Whether the number actually exists is a separate
 * check, reported on blur — the same `phoneIssue` the server schema uses.
 */
export function PhoneField({ label, value, onChange, error, className, variant }: Props) {
  const t = useTranslations("common.phone");
  const parsed = parsePhone(value);
  // Last explicit country pick — only disambiguates countries sharing a dial
  // code; the effective country is derived from `value` on every render.
  const [iso, setIso] = useState(() => isoForDial(parsed.dialCode));
  // Validity is only reported once the field has been left, so the message
  // doesn't fire on every keystroke of a number still being typed.
  const [touched, setTouched] = useState(false);

  const selected =
    countryByIso(isoForDial(parsed.dialCode, iso)) ?? countryByIso(DEFAULT_COUNTRY_ISO)!;
  const nationalDisplay = formatNationalDigits(parsed.national, selected.iso);

  const issue = touched ? phoneIssue(value) : null;
  // A server-side field error outranks the local check.
  const message =
    error ??
    (issue === "invalid" ? t("invalid") : issue === "landline" ? t("mobileOnly") : undefined);

  function updateCountry(nextIso: string) {
    const next = countryByIso(nextIso);
    if (!next) return;
    setIso(next.iso);
    onChange(buildPhone(next.iso, parsed.national));
  }

  function updateNational(raw: string) {
    onChange(buildPhone(selected.iso, raw));
  }

  return (
    <label
      className={cn(
        "ff phone-field",
        variant && `phone-field--${variant}`,
        message && "ff-err",
        className,
      )}
    >
      <div className="phone-field__row">
        <div className="phone-field__code-wrap">
          <span className="phone-field__code-display" aria-hidden>
            +{selected.dial}
          </span>
          <select
            className="phone-field__code"
            value={selected.iso}
            aria-label={t("countryCode")}
            onChange={(event) => updateCountry(event.target.value)}
          >
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.iso} value={country.iso}>
                +{country.dial} · {country.name}
              </option>
            ))}
          </select>
        </div>
        <input
          className="ff-input phone-field__number"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          // In the modals `label` is the only visible label (it doubles as the
          // placeholder), so it wins; the forms that render their own <span>
          // label pass none and get the country's example number instead.
          placeholder={label ?? examplePhoneForCountry(selected.iso)}
          aria-label={label}
          aria-invalid={message ? true : undefined}
          value={nationalDisplay}
          onBlur={() => {
            setTouched(true);
            if (isPhoneEmpty(value)) onChange("");
          }}
          onChange={(event) => updateNational(event.target.value)}
        />
      </div>
      {message ? <span className="ff-error-msg">{message}</span> : null}
    </label>
  );
}
