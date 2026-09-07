import type { ImageConsentConfig } from "@/content/types";
import { RequiredMark } from "./RequiredMark";

export function ImageConsentField({
  config,
  value,
  onChange,
  error,
  requiredHint,
}: {
  config: ImageConsentConfig;
  value: "agree" | "disagree" | null;
  onChange: (value: "agree" | "disagree") => void;
  error?: boolean;
  requiredHint: string;
}) {
  return (
    <fieldset
      className={`rounded-xl border p-4 ${
        error ? "border-brand-error bg-brand-error/5" : "border-brand-border bg-white/[0.03]"
      }`}
    >
      <legend className="px-1 text-sm font-semibold text-brand-text">
        {config.question}
        <RequiredMark requiredHint={requiredHint} />
      </legend>

      <div className="mt-3 space-y-3">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
            value === "agree"
              ? "border-brand-accent/60 bg-brand-accentSoft"
              : "border-brand-border hover:bg-white/[0.05]"
          }`}
        >
          <input
            type="radio"
            name="imageConsent"
            value="agree"
            checked={value === "agree"}
            onChange={() => onChange("agree")}
            className="mt-0.5 h-5 w-5 shrink-0 border-brand-borderStrong bg-brand-bgElevated text-brand-accent focus:ring-brand-accent"
          />
          <span className="text-sm leading-relaxed">
            <span className="block font-semibold text-brand-success">
              {config.agreeLabel}
            </span>
            <span className="mt-1 block text-xs text-brand-textMuted">
              {config.agreeNote}
            </span>
          </span>
        </label>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
            value === "disagree"
              ? "border-brand-accent/60 bg-brand-accentSoft"
              : "border-brand-border hover:bg-white/[0.05]"
          }`}
        >
          <input
            type="radio"
            name="imageConsent"
            value="disagree"
            checked={value === "disagree"}
            onChange={() => onChange("disagree")}
            className="mt-0.5 h-5 w-5 shrink-0 border-brand-borderStrong bg-brand-bgElevated text-brand-accent focus:ring-brand-accent"
          />
          <span className="text-sm leading-relaxed">
            <span className="block font-semibold">{config.disagreeLabel}</span>
            <span className="mt-1 block text-xs text-brand-textMuted">
              {config.disagreeNote}
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
