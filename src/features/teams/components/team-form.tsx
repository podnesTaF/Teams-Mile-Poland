"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { slugify } from "@/features/admin/news-slug";
import { cn } from "@/lib/utils";
import { useActionRun } from "@/lib/use-action-run";

import { updateTeam } from "../actions/team";

type FormState = {
  name: string;
  region: string;
  recruiting: boolean;
  description: string;
};

type Props = {
  /** The team being edited. */
  slug: string;
  initial?: Partial<FormState>;
  /** Locale-aware `/legal/team-rules`, resolved on the server. */
  rulesHref: string;
};

const EMPTY: FormState = {
  name: "",
  region: "",
  recruiting: false,
  description: "",
};

const NAME_MIN = 3;
const REGION_MIN = 2;

type TextField = "name" | "region";

/**
 * The team settings form on the manager view of `/teams/[slug]`. Plain
 * `useState` + the house dark form vocabulary (`.flabel.on-dark`,
 * `.finput.on-dark`, `.field-msg`), no react-hook-form.
 *
 * Edit only: a team cannot be created any more (ADR 0016), so the create shape
 * of this form — category select, ACER price, "Create the team" — is gone with
 * `/teams/new`. Category is immutable and is not shown.
 *
 * `recruiting` is not offered either: teams take members by invitation only,
 * so "looking for runners, listed publicly" no longer means anything to a
 * visitor. The flag stays an admin hint, edited from `/admin/teams`; this form
 * sends back whatever value the team already has, so saving here never flips it.
 *
 * Validation is quiet until the runner has left a field or pressed submit:
 * a form that opens with red text under every empty field reads as already
 * failed. Hints are muted (`.fhint`), errors are red (`.field-msg`).
 */
export function TeamForm({ slug, initial, rulesHref }: Props) {
  const t = useTranslations("teams.form");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [data, setData] = useState<FormState>({ ...EMPTY, ...initial });
  const [touched, setTouched] = useState<Record<TextField, boolean>>({
    name: false,
    region: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useActionRun(() => setError(tReasons("failed")));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function touch(key: TextField) {
    setTouched((s) => (s[key] ? s : { ...s, [key]: true }));
  }

  const nameError = data.name.trim().length < NAME_MIN ? t("nameTooShort") : null;
  const regionError = data.region.trim().length < REGION_MIN ? t("regionTooShort") : null;
  const valid = !nameError && !regionError;

  // Soft warning only (team rules §2.3.4 asks for the region in the name).
  // Never a block: "Warsaw Aces" is a legitimate name for region "Warszawa",
  // and a hard substring check would reject it. Compared through `slugify` so
  // diacritics and case do not create false alarms. Shown only once both
  // fields have been left, so it does not flash while the runner is typing.
  const nameSlug = slugify(data.name);
  const regionSlug = slugify(data.region);
  const regionMissing =
    touched.name &&
    touched.region &&
    data.name.trim().length > 0 &&
    regionSlug.length > 1 &&
    !nameSlug.includes(regionSlug);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!valid) {
      setTouched({ name: true, region: true });
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateTeam(slug, {
        name: data.name.trim(),
        region: data.region.trim(),
        recruiting: data.recruiting,
        description: data.description.trim(),
      });

      if (!result.ok) {
        setError(tReasons(result.reason));
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const showNameError = touched.name && nameError;
  const showRegionError = touched.region && regionError;
  const descriptionLeft = 280 - data.description.length;

  return (
    <form className="profile-form team-form" onSubmit={onSubmit} data-team-form="edit" noValidate>
      {error ? (
        <div className="banner banner--red" role="alert">
          <div className="banner__body">
            <div className="banner__txt">{error}</div>
          </div>
        </div>
      ) : null}
      {saved ? (
        <div className="banner banner--ok" role="status">
          <div className="banner__body">
            <div className="banner__txt">{t("saved")}</div>
          </div>
        </div>
      ) : null}

      <div className="form-section">
        <div className="fgrid">
          <label className="block col-2">
            <span className="flabel on-dark">{t("name")}</span>
            <input
              className={cn("finput on-dark", showNameError && "finput--err")}
              value={data.name}
              maxLength={60}
              autoComplete="off"
              onChange={(event) => set("name", event.target.value)}
              onBlur={() => touch("name")}
              aria-invalid={showNameError ? true : undefined}
              required
            />
            {showNameError ? (
              <span className="field-msg">{nameError}</span>
            ) : (
              <span className="fhint">{t("nameHint")}</span>
            )}
          </label>

          <label className="block col-2">
            <span className="flabel on-dark">{t("region")}</span>
            <input
              className={cn("finput on-dark", showRegionError && "finput--err")}
              value={data.region}
              maxLength={60}
              autoComplete="off"
              onChange={(event) => set("region", event.target.value)}
              onBlur={() => touch("region")}
              aria-invalid={showRegionError ? true : undefined}
              required
            />
            {showRegionError ? <span className="field-msg">{regionError}</span> : null}
          </label>
        </div>

        {regionMissing ? (
          <div className="banner banner--warn team-form__warn" role="status">
            <div className="banner__body">
              <div className="banner__txt">{t("regionWarning")}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="form-section">
        <label className="block">
          <span className="flabel on-dark">
            {t("description")} <span className="flabel__opt">{t("optional")}</span>
          </span>
          <textarea
            className="finput on-dark team-form__textarea"
            value={data.description}
            maxLength={280}
            rows={3}
            onChange={(event) => set("description", event.target.value)}
          />
          <span className="fhint fhint--row">
            <span>{t("descriptionHint")}</span>
            <span className="fhint__count" aria-live="polite">
              {descriptionLeft}
            </span>
          </span>
        </label>
      </div>

      <div className="form-actions">
        <a
          className="form-actions__note team-form__rules"
          href={rulesHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("rulesLink")} ↗
        </a>
        <button type="submit" className="btn btn-red" disabled={pending}>
          {pending ? t("submitting") : t("submitSave")}
        </button>
      </div>
    </form>
  );
}
