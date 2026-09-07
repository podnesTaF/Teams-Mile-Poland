import type { FieldConfig } from "@/content/types";
import { RequiredMark } from "./RequiredMark";

export function TextField({
  field,
  value,
  onChange,
  error,
  requiredHint,
  errorText,
}: {
  field: FieldConfig;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  requiredHint: string;
  errorText: string;
}) {
  const inputId = `field-${field.name}`;
  const inputType =
    field.type === "date" ? "date" : field.type === "tel" ? "tel" : field.type === "email" ? "email" : "text";

  return (
    <div>
      <label htmlFor={inputId} className="field-label">
        {field.label}
        {field.required && <RequiredMark requiredHint={requiredHint} />}
      </label>
      {field.type === "select" ? (
        <select
          id={inputId}
          name={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          aria-required={field.required}
          aria-invalid={error || undefined}
          aria-describedby={
            field.helpText || error ? `${inputId}-help` : undefined
          }
          className={`field-input ${error ? "border-brand-error" : ""}`}
        >
          <option value="" disabled>
            {field.placeholder ?? "—"}
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={inputId}
          name={field.name}
          type={inputType}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          aria-required={field.required}
          aria-invalid={error || undefined}
          aria-describedby={
            field.helpText || error ? `${inputId}-help` : undefined
          }
          className={`field-input ${error ? "border-brand-error" : ""}`}
        />
      )}
      {(field.helpText || error) && (
        <p
          id={`${inputId}-help`}
          className={`mt-1.5 text-xs ${
            error ? "text-brand-error" : "text-brand-textMuted"
          }`}
        >
          {error ? errorText : field.helpText}
        </p>
      )}
    </div>
  );
}
