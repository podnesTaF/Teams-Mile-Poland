"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import {
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { AGE_CATEGORIES, EVENT } from "@/lib/marketing/event";
import { submitRegistration } from "@/features/registration/actions";
import {
  defaultConsents,
  defaultRunner,
  freeRunnerSchema,
  joinTeamSchema,
  REGIONS,
  soloRunnerSchema,
  startTeamSchema,
  type RegistrationFlow,
  type RegistrationPayload,
} from "@/features/registration/schemas";
import { cn } from "@/lib/utils";

type RegistrationFormProps = {
  flow: RegistrationFlow;
  teamCode?: string;
};

const flowCopy = {
  start: {
    steps: ["team", "captain", "medical", "review"],
    submit: "start",
  },
  join: {
    steps: ["runner", "medical", "review"],
    submit: "join",
  },
  free: {
    steps: ["runner", "preferences", "medical", "review"],
    submit: "free",
  },
  solo: {
    steps: ["runner", "optional", "medical", "review"],
    submit: "solo",
  },
} as const;

const schemaByFlow = {
  start: startTeamSchema,
  join: joinTeamSchema,
  free: freeRunnerSchema,
  solo: soloRunnerSchema,
} as const;

export function RegistrationForm({ flow, teamCode = "" }: RegistrationFormProps) {
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("registration.form");
  const copy = flowCopy[flow];
  const form = useForm<FieldValues>({
    resolver: zodResolver(schemaByFlow[flow]) as unknown as Resolver<FieldValues>,
    defaultValues: defaultValues(flow, teamCode),
    mode: "onBlur",
  });

  const steps = copy.steps;
  const isLast = step === steps.length - 1;
  const priceLabel = useMemo(
    () => t("pricingLine", { price: EVENT.freeTier.pricePln }),
    [t],
  );

  async function nextStep() {
    const ok = await form.trigger(fieldsForStep(flow, step));
    if (ok) setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function onSubmit(data: FieldValues) {
    setServerError(null);
    startTransition(async () => {
      const result = await submitRegistration(data as RegistrationPayload);
      if (!result.ok) {
        setServerError(result.message);
        return;
      }

      window.location.assign(result.redirectTo);
    });
  }

  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      className="p-5 md:p-7"
    >
      <Stepper steps={steps} current={step} />

      <div className="mt-7">
        {flow === "start" && step === 0 ? <TeamInfo form={form} /> : null}
        {((flow === "start" && step === 1) ||
          (flow === "join" && step === 0) ||
          (flow === "free" && step === 0) ||
          (flow === "solo" && step === 0)) ? (
          <RunnerInfo form={form} includeAgeCategory={flow === "join"} />
        ) : null}
        {flow === "free" && step === 1 ? <Preferences form={form} /> : null}
        {flow === "solo" && step === 1 ? <SoloOptional form={form} /> : null}
        {((flow === "start" && step === 2) ||
          (flow === "join" && step === 1) ||
          (flow === "free" && step === 2) ||
          (flow === "solo" && step === 2)) ? (
          <MedicalConsents form={form} priceLabel={priceLabel} />
        ) : null}
        {isLast ? <Review values={form.getValues()} flow={flow} /> : null}
      </div>

      {serverError ? (
        <div className="mt-6 border border-accent bg-accent-soft p-4 text-sm text-accent">
          {serverError}
        </div>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
        <Button
          type="button"
          intent="ghost"
          onClick={() => setStep((current) => Math.max(current - 1, 0))}
          disabled={step === 0 || isPending}
        >
          {t("buttons.back")}
        </Button>
        {isLast ? (
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isPending}
          >
            {isPending ? t("buttons.submitting") : t(`buttons.${copy.submit}`)}
            <span aria-hidden>→</span>
          </Button>
        ) : (
          <Button type="button" onClick={nextStep} disabled={isPending}>
            {t("buttons.continue")}
            <span aria-hidden>→</span>
          </Button>
        )}
      </div>
    </form>
  );
}

function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  const t = useTranslations("registration.form.steps");

  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {steps.map((label, idx) => (
        <li
          key={label}
          className={cn(
            "border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em]",
            idx === current
              ? "border-ink bg-ink text-white"
              : idx < current
                ? "border-accent bg-accent text-white"
                : "border-line bg-bg-2 text-muted",
          )}
        >
          {idx + 1}. {t(label)}
        </li>
      ))}
    </ol>
  );
}

function TeamInfo({ form }: { form: UseFormReturn<FieldValues> }) {
  const t = useTranslations("registration.form");

  return (
    <FormSection title={t("sections.team")}>
      <Field label={t("fields.teamName")} error={error(form, "team.name")}>
        <Input {...form.register("team.name")} placeholder={t("placeholders.team")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("fields.category")} error={error(form, "team.category")}>
          <Select {...form.register("team.category")}>
            <option value="">{t("options.choose")}</option>
            <option value="mens">{t("options.mens")}</option>
            <option value="womens">{t("options.womens")}</option>
            <option value="mixed">{t("options.mixed")}</option>
          </Select>
        </Field>
        <Field label={t("fields.region")} error={error(form, "team.region")}>
          <Select {...form.register("team.region")}>
            <option value="">{t("options.choose")}</option>
            {REGIONS.map((region) => (
              <option key={region}>{region}</option>
            ))}
          </Select>
        </Field>
      </div>
    </FormSection>
  );
}

function RunnerInfo({
  form,
  includeAgeCategory = false,
}: {
  form: UseFormReturn<FieldValues>;
  includeAgeCategory?: boolean;
}) {
  const prefix = "runner";
  const t = useTranslations("registration.form");

  return (
    <FormSection
      title={t("sections.runner")}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("fields.firstName")} error={error(form, `${prefix}.firstName`)}>
          <Input {...form.register(`${prefix}.firstName`)} placeholder={t("placeholders.firstName")} />
        </Field>
        <Field label={t("fields.lastName")} error={error(form, `${prefix}.lastName`)}>
          <Input {...form.register(`${prefix}.lastName`)} placeholder={t("placeholders.lastName")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("fields.email")} hint={t("hints.magic")} error={error(form, `${prefix}.email`)}>
          <Input type="email" {...form.register(`${prefix}.email`)} placeholder="anna@example.com" />
        </Field>
        <Field label={t("fields.phone")} error={error(form, `${prefix}.phone`)}>
          <Input type="tel" {...form.register(`${prefix}.phone`)} placeholder="+48 600 000 000" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("fields.dob")} error={error(form, `${prefix}.dob`)}>
          <Input type="date" {...form.register(`${prefix}.dob`)} />
        </Field>
        <Field label={t("fields.gender")} error={error(form, `${prefix}.gender`)}>
          <Select {...form.register(`${prefix}.gender`)}>
            <option value="">{t("options.choose")}</option>
            <option value="female">{t("options.female")}</option>
            <option value="male">{t("options.male")}</option>
          </Select>
        </Field>
      </div>
      <Field label={t("fields.nationality")} error={error(form, `${prefix}.nationality`)}>
        <Input {...form.register(`${prefix}.nationality`)} placeholder={t("placeholders.nationality")} />
      </Field>
      {includeAgeCategory ? <AgeCategoryField form={form} name="runner.ageCategory" /> : null}
      <details className="border border-line bg-bg-2 p-4">
        <summary className="cursor-pointer font-display-alt text-sm font-semibold uppercase tracking-[0.06em]">
          {t("optionalSummary")}
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.club")}>
            <Input {...form.register(`${prefix}.club`)} placeholder={t("placeholders.club")} />
          </Field>
          <Field label={t("fields.coach")}>
            <Input {...form.register(`${prefix}.coach`)} placeholder={t("placeholders.coach")} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label={t("fields.personalBest")} hint={t("hints.personalBest")}>
            <Input {...form.register(`${prefix}.personalBest`)} placeholder="5:42" />
          </Field>
        </div>
      </details>
    </FormSection>
  );
}

function Preferences({ form }: { form: UseFormReturn<FieldValues> }) {
  const t = useTranslations("registration.form");

  return (
    <FormSection title={t("sections.preferences")}>
      <AgeCategoryField form={form} name="preferences.ageCategory" />
      <Field label={t("fields.preferredRegion")} error={error(form, "preferences.preferredRegion")}>
        <Select {...form.register("preferences.preferredRegion")}>
          <option value="">{t("options.noPreference")}</option>
          {REGIONS.map((region) => (
            <option key={region}>{region}</option>
          ))}
        </Select>
      </Field>
      <Field
        label={t("fields.teammates")}
        hint={t("hints.optional")}
        error={error(form, "preferences.preferredTeammates")}
      >
        <Textarea {...form.register("preferences.preferredTeammates")} rows={4} />
      </Field>
    </FormSection>
  );
}

function SoloOptional({ form }: { form: UseFormReturn<FieldValues> }) {
  const t = useTranslations("registration.form");

  return (
    <FormSection title={t("sections.solo")}>
      <AgeCategoryField form={form} name="solo.ageCategory" />
    </FormSection>
  );
}

function MedicalConsents({
  form,
  priceLabel,
}: {
  form: UseFormReturn<FieldValues>;
  priceLabel: string;
}) {
  const t = useTranslations("registration.form");

  return (
    <FormSection
      title={t("sections.medical")}
    >
      <Check form={form} name="consents.medical">
        {t("consents.medical")}
      </Check>
      <Check form={form} name="consents.gdpr">
        {t("consents.gdpr")}
      </Check>
      <Check form={form} name="consents.rules">
        {t("consents.rules")}
      </Check>
      <Check form={form} name="consents.image">
        {t("consents.image")}
      </Check>
      <Check form={form} name="consents.liability">
        {t("consents.liability")}
      </Check>
      <div className="border border-accent bg-accent-soft p-4">
        <div className="font-display-alt text-sm font-semibold uppercase tracking-[0.08em] text-accent">
          {t("pricingTitle")}
        </div>
        <p className="mt-1 text-sm text-muted">{priceLabel}.</p>
      </div>
    </FormSection>
  );
}

function Review({ values, flow }: { values: FieldValues; flow: RegistrationFlow }) {
  const t = useTranslations("registration.form");

  return (
    <FormSection title={t("sections.review")}>
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {flow === "start" ? <ReviewItem label={t("review.team")} value={values.team?.name} /> : null}
        {flow === "join" ? <ReviewItem label={t("review.teamCode")} value={values.teamCode} /> : null}
        <ReviewItem label={t("review.runner")} value={`${values.runner?.firstName ?? ""} ${values.runner?.lastName ?? ""}`} />
        <ReviewItem label={t("review.email")} value={values.runner?.email} />
        <ReviewItem label={t("review.flow")} value={t(`review.${flow}`)} />
        <ReviewItem label={t("review.price")} value={t("review.priceValue", { price: EVENT.freeTier.pricePln })} />
      </div>
    </FormSection>
  );
}

function AgeCategoryField({
  form,
  name,
}: {
  form: UseFormReturn<FieldValues>;
  name: string;
}) {
  const t = useTranslations("registration.form");

  return (
    <Field label={t("fields.ageCategory")} error={error(form, name)}>
      <Select {...form.register(name)}>
        <option value="">{t("options.choose")}</option>
        {AGE_CATEGORIES.map((category) => (
          <option key={category.code} value={category.code}>
            {category.code} - {category.age}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function FormSection({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display-alt text-xl font-semibold tracking-tight">{title}</h2>
        {desc ? <p className="mt-1 max-w-prose text-sm text-muted">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  error: errorMessage,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("registration.form");

  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
      {errorMessage ? <span className="mt-1.5 block text-xs text-accent">{t("validation.field")}</span> : null}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-12 w-full border border-line bg-bg px-3 text-sm outline-none transition-colors focus:border-ink",
        props.className,
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-12 w-full border border-line bg-bg px-3 text-sm outline-none transition-colors focus:border-ink",
        props.className,
      )}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full border border-line bg-bg p-3 text-sm outline-none transition-colors focus:border-ink",
        props.className,
      )}
    />
  );
}

function Check({
  form,
  name,
  children,
}: {
  form: UseFormReturn<FieldValues>;
  name: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("registration.form");

  return (
    <label className="flex gap-3 border border-line bg-bg-2 p-4 text-sm leading-relaxed">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-black" {...form.register(name)} />
      <span>
        {children}
        {error(form, name) ? <span className="mt-1 block text-xs text-accent">{t("validation.field")}</span> : null}
      </span>
    </label>
  );
}

function ReviewItem({ label, value }: { label: string; value?: string }) {
  const t = useTranslations("registration.form");

  return (
    <div className="border border-line bg-bg-2 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="mt-1 font-display-alt font-semibold">{value || t("review.empty")}</div>
    </div>
  );
}

function defaultValues(flow: RegistrationFlow, teamCode: string) {
  if (flow === "start") {
    return { flow, team: { name: "", category: "", region: "" }, runner: defaultRunner, consents: defaultConsents };
  }

  if (flow === "join") {
    return {
      flow,
      teamCode,
      runner: { ...defaultRunner, ageCategory: "" },
      consents: defaultConsents,
    };
  }

  if (flow === "free") {
    return {
      flow,
      runner: defaultRunner,
      preferences: { ageCategory: "", preferredRegion: "", preferredTeammates: "" },
      consents: defaultConsents,
    };
  }

  return { flow, runner: defaultRunner, solo: { ageCategory: "" }, consents: defaultConsents };
}

function fieldsForStep(flow: RegistrationFlow, step: number) {
  if (flow === "start") {
    return step === 0 ? ["team"] : step === 1 ? ["runner"] : ["consents"];
  }

  if (flow === "join") {
    return step === 0 ? ["runner"] : ["consents"];
  }

  if (flow === "free") {
    return step === 0 ? ["runner"] : step === 1 ? ["preferences"] : ["consents"];
  }

  return step === 0 ? ["runner"] : step === 1 ? ["solo"] : ["consents"];
}

function error(form: UseFormReturn<FieldValues>, path: string) {
  const value = path
    .split(".")
    .reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in acc) {
        return (acc as Record<string, unknown>)[part];
      }

      return undefined;
    }, form.formState.errors);

  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }

  return undefined;
}

