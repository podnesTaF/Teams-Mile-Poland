"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
    steps: ["Team", "Captain", "Medical", "Review"],
    submit: "Create team",
  },
  join: {
    steps: ["Runner", "Medical", "Review"],
    submit: "Join team",
  },
  free: {
    steps: ["Runner", "Preferences", "Medical", "Review"],
    submit: "Register as free runner",
  },
  solo: {
    steps: ["Runner", "Optional", "Medical", "Review"],
    submit: "Register solo",
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
  const copy = flowCopy[flow];
  const form = useForm<FieldValues>({
    resolver: zodResolver(schemaByFlow[flow]) as unknown as Resolver<FieldValues>,
    defaultValues: defaultValues(flow, teamCode),
    mode: "onBlur",
  });

  const steps = copy.steps;
  const isLast = step === steps.length - 1;
  const priceLabel = useMemo(() => `Then ${EVENT.freeTier.pricePln} PLN`, []);

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
          Back
        </Button>
        {isLast ? (
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isPending}
          >
            {isPending ? "Submitting..." : copy.submit}
            <span aria-hidden>→</span>
          </Button>
        ) : (
          <Button type="button" onClick={nextStep} disabled={isPending}>
            Continue
            <span aria-hidden>→</span>
          </Button>
        )}
      </div>
    </form>
  );
}

function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
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
          {idx + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

function TeamInfo({ form }: { form: UseFormReturn<FieldValues> }) {
  return (
    <FormSection title="Team info">
      <Field label="Team name" error={error(form, "team.name")}>
        <Input {...form.register("team.name")} placeholder="Warsaw Wolves" />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" error={error(form, "team.category")}>
          <Select {...form.register("team.category")}>
            <option value="">Choose...</option>
            <option value="mens">Mens</option>
            <option value="womens">Womens</option>
            <option value="mixed">Mixed</option>
          </Select>
        </Field>
        <Field label="Region" error={error(form, "team.region")}>
          <Select {...form.register("team.region")}>
            <option value="">Choose...</option>
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

  return (
    <FormSection
      title="Runner info"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" error={error(form, `${prefix}.firstName`)}>
          <Input {...form.register(`${prefix}.firstName`)} placeholder="Anna" />
        </Field>
        <Field label="Last name" error={error(form, `${prefix}.lastName`)}>
          <Input {...form.register(`${prefix}.lastName`)} placeholder="Kowalska" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" hint="Magic link goes here" error={error(form, `${prefix}.email`)}>
          <Input type="email" {...form.register(`${prefix}.email`)} placeholder="anna@example.com" />
        </Field>
        <Field label="Phone" error={error(form, `${prefix}.phone`)}>
          <Input type="tel" {...form.register(`${prefix}.phone`)} placeholder="+48 600 000 000" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date of birth" error={error(form, `${prefix}.dob`)}>
          <Input type="date" {...form.register(`${prefix}.dob`)} />
        </Field>
        <Field label="Gender" error={error(form, `${prefix}.gender`)}>
          <Select {...form.register(`${prefix}.gender`)}>
            <option value="">Choose...</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </Select>
        </Field>
      </div>
      <Field label="Nationality" error={error(form, `${prefix}.nationality`)}>
        <Input {...form.register(`${prefix}.nationality`)} placeholder="Poland" />
      </Field>
      {includeAgeCategory ? <AgeCategoryField form={form} name="runner.ageCategory" /> : null}
      <details className="border border-line bg-bg-2 p-4">
        <summary className="cursor-pointer font-display-alt text-sm font-semibold uppercase tracking-[0.06em]">
          Optional: club, coach, personal best
        </summary>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Running club">
            <Input {...form.register(`${prefix}.club`)} placeholder="AZS Warsaw" />
          </Field>
          <Field label="Coach">
            <Input {...form.register(`${prefix}.coach`)} placeholder="Coach name" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Personal best mile" hint="Use m:ss or seconds">
            <Input {...form.register(`${prefix}.personalBest`)} placeholder="5:42" />
          </Field>
        </div>
      </details>
    </FormSection>
  );
}

function Preferences({ form }: { form: UseFormReturn<FieldValues> }) {
  return (
    <FormSection title="Preferences">
      <AgeCategoryField form={form} name="preferences.ageCategory" />
      <Field label="Preferred region" error={error(form, "preferences.preferredRegion")}>
        <Select {...form.register("preferences.preferredRegion")}>
          <option value="">No preference</option>
          {REGIONS.map((region) => (
            <option key={region}>{region}</option>
          ))}
        </Select>
      </Field>
      <Field
        label="Teammates you would like to be grouped with"
        hint="Optional"
        error={error(form, "preferences.preferredTeammates")}
      >
        <Textarea {...form.register("preferences.preferredTeammates")} rows={4} />
      </Field>
    </FormSection>
  );
}

function SoloOptional({ form }: { form: UseFormReturn<FieldValues> }) {
  return (
    <FormSection title="Solo details">
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
  return (
    <FormSection
      title="Medical + consents"
    >
      <Check form={form} name="consents.medical">
        <strong>I declare I have no medical contraindications</strong> to running a mile at competition pace.
      </Check>
      <Check form={form} name="consents.gdpr">
        I consent to personal data processing for race administration, ranking, and event contact.
      </Check>
      <Check form={form} name="consents.rules">
        I have read and accept the TEAMS MILE Warsaw rules and ABA rating regulations.
      </Check>
      <Check form={form} name="consents.image">
        I consent to use of my image in event photography, broadcast, and post-race publications.
      </Check>
      <Check form={form} name="consents.liability">
        I acknowledge the liability waiver and race at my own risk.
      </Check>
      <div className="border border-accent bg-accent-soft p-4">
        <div className="font-display-alt text-sm font-semibold uppercase tracking-[0.08em] text-accent">
          First 300 runners pay 0 PLN
        </div>
        <p className="mt-1 text-sm text-muted">{priceLabel}.</p>
      </div>
    </FormSection>
  );
}

function Review({ values, flow }: { values: FieldValues; flow: RegistrationFlow }) {
  return (
    <FormSection title="Review">
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {flow === "start" ? <ReviewItem label="Team" value={values.team?.name} /> : null}
        {flow === "join" ? <ReviewItem label="Team code" value={values.teamCode} /> : null}
        <ReviewItem label="Runner" value={`${values.runner?.firstName ?? ""} ${values.runner?.lastName ?? ""}`} />
        <ReviewItem label="Email" value={values.runner?.email} />
        <ReviewItem label="Flow" value={flowLabel(flow)} />
        <ReviewItem label="Price" value="0 PLN if slots remain, otherwise 50 PLN" />
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
  return (
    <Field label="Age category" error={error(form, name)}>
      <Select {...form.register(name)}>
        <option value="">Choose...</option>
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
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
      {errorMessage ? <span className="mt-1.5 block text-xs text-accent">{errorMessage}</span> : null}
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
  return (
    <label className="flex gap-3 border border-line bg-bg-2 p-4 text-sm leading-relaxed">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-black" {...form.register(name)} />
      <span>
        {children}
        {error(form, name) ? <span className="mt-1 block text-xs text-accent">{error(form, name)}</span> : null}
      </span>
    </label>
  );
}

function ReviewItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="border border-line bg-bg-2 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{label}</div>
      <div className="mt-1 font-display-alt font-semibold">{value || "Not provided"}</div>
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

function flowLabel(flow: RegistrationFlow) {
  if (flow === "start") return "Team initiator";
  if (flow === "join") return "Joining runner";
  if (flow === "free") return "Free runner";
  return "Solo rating mile";
}
