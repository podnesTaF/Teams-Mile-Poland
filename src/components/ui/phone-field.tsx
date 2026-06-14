"use client";

import { useEffect, useState } from "react";

import { COUNTRY_OPTIONS, countryByDial, countryByIso } from "@/lib/country-calling-codes";
import {
  DEFAULT_COUNTRY_ISO,
  buildPhone,
  formatNationalDigits,
  isPhoneEmpty,
  parsePhone,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
};

function isoForDial(dialCode: string, preferredIso?: string): string {
  if (preferredIso && countryByIso(preferredIso)?.dial === dialCode) return preferredIso;
  return countryByDial(dialCode)?.iso ?? DEFAULT_COUNTRY_ISO;
}

/**
 * Phone input with a country-code selector and a masked national number field.
 * Defaults to Poland (+48) and stores values like "+48 512 345 678".
 */
export function PhoneField({ label, value, onChange, error, className }: Props) {
  const parsed = parsePhone(value);
  const [iso, setIso] = useState(() => isoForDial(parsed.dialCode));

  useEffect(() => {
    setIso((current) => isoForDial(parsed.dialCode, current));
  }, [parsed.dialCode]);

  const selected = countryByIso(iso) ?? countryByIso(DEFAULT_COUNTRY_ISO)!;
  const nationalDisplay = formatNationalDigits(parsed.national);

  function updateCountry(nextIso: string) {
    const next = countryByIso(nextIso);
    if (!next) return;
    setIso(next.iso);
    onChange(buildPhone(next.dial, parsed.national));
  }

  function updateNational(raw: string) {
    const digits = raw.replace(/\D/g, "");
    onChange(buildPhone(selected.dial, digits));
  }

  return (
    <label className={cn("ff phone-field", error && "ff-err", className)}>
      <div className="phone-field__row">
        <div className="phone-field__code-wrap">
          <span className="phone-field__code-display" aria-hidden>
            +{selected.dial}
          </span>
          <select
            className="phone-field__code"
            value={iso}
            aria-label="Country code"
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
          placeholder={label}
          value={nationalDisplay}
          onBlur={() => {
            if (isPhoneEmpty(value)) onChange("");
          }}
          onChange={(event) => updateNational(event.target.value)}
        />
      </div>
      {error ? <span className="ff-error-msg">{error}</span> : null}
    </label>
  );
}
