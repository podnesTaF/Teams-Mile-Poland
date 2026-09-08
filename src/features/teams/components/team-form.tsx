"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Cbx } from "@/components/ui/cbx";
import { FloatField } from "@/components/ui/float-field";
import { useRouter } from "@/i18n/navigation";
import { slugify } from "@/features/admin/news-slug";

import { createTeam, updateTeam } from "../actions/team";
import { TEAM_CATEGORIES, type TeamCategory } from "../config";

type FormState = {
  name: string;
  region: string;
  category: TeamCategory;
  recruiting: boolean;
  description: string;
};

type Props = {
  mode: "create" | "edit";
  /** Required in `edit` mode — the team being edited. */
  slug?: string;
  initial?: Partial<FormState>;
  /** Locale-aware `/legal/team-rules`, resolved on the server. */
  rulesHref: string;
};

const EMPTY: FormState = {
  name: "",
  region: "",
  category: "men",
  recruiting: true,
  description: "",
};

/**
 * The one team form, in both its shapes: creating a team and editing one.
 * Plain `useState` + `.iv-*` / `FloatField`, no react-hook-form — the house
 * form vocabulary.
 *
 * Category is rendered only in `create` mode: it is immutable afterwards, so an
 * edit form that shows a disabled category select would just invite the
 * question. `recruiting` is the "do you have all your teammates?" question at
 * creation and the recruiting toggle afterwards — one field, two labels.
 */
export function TeamForm({ mode, slug, initial, rulesHref }: Props) {
  const t = useTranslations("teams.form");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [data, setData] = useState<FormState>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  // Soft warning only (team rules §2.3.4 asks for the region in the name).
  // Never a block: "Warsaw Aces" is a legitimate name for region "Warszawa",
  // and a hard substring check would reject it. Compared through `slugify` so
  // diacritics and case do not create false alarms.
  const nameSlug = slugify(data.name);
  const regionSlug = slugify(data.region);
  const regionMissing =
    data.name.trim().length > 0 && regionSlug.length > 1 && !nameSlug.includes(regionSlug);

  const ready = data.name.trim().length >= 3 && data.region.trim().length >= 2;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || pending) return;
    setError(null);
    startTransition(async () => {
      const payload = {
        name: data.name.trim(),
        region: data.region.trim(),
        recruiting: data.recruiting,
        description: data.description.trim(),
      };
      const result =
        mode === "create"
          ? await createTeam({ ...payload, category: data.category })
          : await updateTeam(slug ?? "", payload);

      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      if (mode === "create" && "slug" in result) {
        router.push(`/teams/${result.slug}`);
        router.refresh();
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form className="iv-card" onSubmit={onSubmit} data-team-form={mode}>
      {error ? (
        <div className="banner banner--red" role="alert">
          {error}
        </div>
      ) : null}
      {saved ? <div className="banner banner--ok">{t("saved")}</div> : null}

      <FloatField
        label={t("name")}
        value={data.name}
        maxLength={60}
        onChange={(event) => set("name", event.target.value)}
        hint={t("nameHint")}
        required
      />
      <FloatField
        label={t("region")}
        value={data.region}
        maxLength={60}
        onChange={(event) => set("region", event.target.value)}
        hint={regionMissing ? undefined : t("regionHint")}
        required
      />
      {regionMissing ? (
        <div className="banner banner--warn" role="status">
          {t("regionWarning")}
        </div>
      ) : null}

      {mode === "create" ? (
        <FloatField
          as="select"
          label={t("category")}
          value={data.category}
          onChange={(event) => set("category", event.target.value as TeamCategory)}
        >
          {TEAM_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t(`categoryOption.${category}`)}
            </option>
          ))}
        </FloatField>
      ) : null}

      <div>
        <p className="iv-share__hint">{t("recruitingQuestion")}</p>
        <Cbx
          id="team-recruiting"
          checked={data.recruiting}
          onChange={(event) => set("recruiting", event.target.checked)}
        >
          {t("recruitingYes")}
        </Cbx>
      </div>

      <FloatField
        as="textarea"
        label={t("description")}
        value={data.description}
        maxLength={280}
        rows={3}
        onChange={(event) => set("description", event.target.value)}
        hint={t("descriptionHint")}
      />

      <p className="iv-share__hint">
        <a href={rulesHref} target="_blank" rel="noopener noreferrer">
          {t("rulesLink")}
        </a>
      </p>

      <div className="iv-actions">
        <button type="submit" className="btn btn-red" disabled={!ready || pending}>
          {pending ? t("submitting") : mode === "create" ? t("submitCreate") : t("submitSave")}
        </button>
      </div>
    </form>
  );
}
