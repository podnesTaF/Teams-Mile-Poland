import type { CheckboxConfig } from "@/content/types";
import { RequiredMark } from "./RequiredMark";

export function CheckboxField({
  config,
  checked,
  onChange,
  error,
  requiredHint,
}: {
  config: CheckboxConfig;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: boolean;
  requiredHint: string;
}) {
  const inputId = `checkbox-${config.id}`;
  return (
    <label
      htmlFor={inputId}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
        error
          ? "border-brand-error bg-brand-error/5"
          : checked
            ? "border-brand-accent/60 bg-brand-accentSoft"
            : "border-brand-border bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={config.required}
        aria-required={config.required}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-brand-borderStrong bg-brand-bgElevated text-brand-accent focus:ring-brand-accent"
      />
      <span className="text-sm leading-relaxed text-brand-text">
        {config.label}
        {config.required && <RequiredMark requiredHint={requiredHint} />}
      </span>
    </label>
  );
}
