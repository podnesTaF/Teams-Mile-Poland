"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { slugify } from "@/features/admin/news-slug";
import { minorToAcer } from "@/features/wallet/config";
import { cn } from "@/lib/utils";

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
  /**
   * What creating a team costs, in whole ACER, and what the creator holds, in
   * minor units. `create` mode only — an edit is free, and the edit call site
   * passes neither. A price of 0 turns the whole money block off, which is the
   * same switch `createTeam` reads.
   */
  priceAcer?: number;
  balanceMinor?: number;
  /** Whether the wallet link may offer a top-up. Resolved on the server. */
  purchaseEnabled?: boolean;
};

const EMPTY: FormState = {
  name: "",
  region: "",
  category: "men",
  recruiting: true,
  description: "",
};

const NAME_MIN = 3;
const REGION_MIN = 2;

type TextField = "name" | "region";

/**
 * The one team form, in both its shapes: creating a team and editing one.
 * Plain `useState` + the house dark form vocabulary (`.flabel.on-dark`,
 * `.finput.on-dark`, `.fselect.on-dark`, `.field-msg`), no react-hook-form.
 *
 * Validation is quiet until the runner has left a field or pressed submit:
 * a form that opens with red text under every empty field reads as already
 * failed. Hints are muted (`.fhint`), errors are red (`.field-msg`).
 *
 * Category is rendered only in `create` mode: it is immutable afterwards, so an
 * edit form that shows a disabled category select would just invite the
 * question. `recruiting` is a two-card choice — "roster complete, private" vs
 * "looking for runners, listed publicly" — so both answers are spelled out
 * instead of a single checkbox whose unchecked state means nothing obvious.
 *
 * Creating costs ACER, so the create form states the price and the balance
 * above the submit and disables the button when the wallet is short. That is a
 * courtesy, not the rule: the money is judged by `createTeam` inside its
 * transaction, and a form that has been open across a debit elsewhere still
 * comes back with `insufficient_balance` in the error banner.
 */
export function TeamForm({
  mode,
  slug,
  initial,
  rulesHref,
  priceAcer = 0,
  balanceMinor = 0,
  purchaseEnabled = false,
}: Props) {
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
  const [pending, startTransition] = useTransition();

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
    if (pending || short) return;
    if (!valid) {
      setTouched({ name: true, region: true });
      return;
    }
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

  const showNameError = touched.name && nameError;
  const showRegionError = touched.region && regionError;
  const descriptionLeft = 280 - data.description.length;

  // Money, in whole ACER for the copy — the props carry the price in ACER and
  // the balance in minor units, because that is the honest shape of each on the
  // server. Rounded up on the shortfall so "you need 0.5 more" never reads as
  // "you need 0".
  const paid = mode === "create" && priceAcer > 0;
  const balanceAcer = minorToAcer(balanceMinor);
  const short = paid && balanceAcer < priceAcer;
  const missingAcer = Math.ceil(priceAcer - balanceAcer);

  return (
    <form className="profile-form team-form" onSubmit={onSubmit} data-team-form={mode} noValidate>
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

          <label className={cn("block", mode !== "create" && "col-2")}>
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

          {mode === "create" ? (
            <label className="block">
              <span className="flabel on-dark">{t("category")}</span>
              <select
                className="fselect on-dark"
                value={data.category}
                onChange={(event) => set("category", event.target.value as TeamCategory)}
              >
                {TEAM_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`categoryOption.${category}`)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {regionMissing ? (
          <div className="banner banner--warn team-form__warn" role="status">
            <div className="banner__body">
              <div className="banner__txt">{t("regionWarning")}</div>
            </div>
          </div>
        ) : null}
      </div>

      <fieldset className="form-section team-form__fieldset">
        <legend className="flabel on-dark">{t("recruitingLabel")}</legend>
        <div className="choice-cards" role="radiogroup">
          <ChoiceCard
            name="team-recruiting"
            value="open"
            checked={data.recruiting}
            onSelect={() => set("recruiting", true)}
            title={t("recruitingOpenTitle")}
            body={t("recruitingOpenBody")}
          />
          <ChoiceCard
            name="team-recruiting"
            value="closed"
            checked={!data.recruiting}
            onSelect={() => set("recruiting", false)}
            title={t("recruitingClosedTitle")}
            body={t("recruitingClosedBody")}
          />
        </div>
      </fieldset>

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

      {paid ? (
        <div className="form-section" data-team-price={priceAcer}>
          <p className="fhint">
            {t("priceLine", { price: priceAcer })} {t("balanceLine", { balance: balanceAcer })}
          </p>
          {short ? (
            <div className="banner banner--warn" role="status" data-team-short="true">
              <div className="banner__body">
                <div className="banner__txt">
                  {t("shortBy", { missing: missingAcer })}{" "}
                  <Link href="/wallet">
                    {purchaseEnabled ? t("walletLinkTopUp") : t("walletLink")}
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="form-actions">
        <a
          className="form-actions__note team-form__rules"
          href={rulesHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("rulesLink")} ↗
        </a>
        <button type="submit" className="btn btn-red" disabled={pending || short}>
          {pending
            ? t("submitting")
            : mode !== "create"
              ? t("submitSave")
              : paid
                ? t("submitCreatePaid", { price: priceAcer })
                : t("submitCreate")}
        </button>
      </div>
    </form>
  );
}

function ChoiceCard({
  name,
  value,
  checked,
  onSelect,
  title,
  body,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  body: string;
}) {
  return (
    <label className={cn("choice-card", checked && "is-on")}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="choice-card__input"
      />
      <span className="choice-card__dot" aria-hidden />
      <span className="choice-card__text">
        <span className="choice-card__title">{title}</span>
        <span className="choice-card__body">{body}</span>
      </span>
    </label>
  );
}
