"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { minorToAcer } from "@/features/wallet/config";
import { useRouter } from "@/i18n/navigation";
import { localePath } from "@/lib/i18n/config";
import { useActionRun } from "@/lib/use-action-run";

import { enterTeam } from "../actions/entries";
import type { EntryFailure } from "../actions/entries";

/**
 * "Enter this event" — the manager's one-step entry (PRD #64, user story 3),
 * rendered on the team page once per **open team event**.
 *
 * One island for the whole block rather than one per event, because the pending
 * and error state is shared: a manager pressing Enter on the September night
 * must not see two spinners, and a refusal belongs next to the row it refused.
 *
 * A team already entered shows "Entered" and a link to its entry page instead
 * of the button (user story 14) — the row is still rendered, because the
 * absence of a button is not an answer.
 *
 * The refusals this surfaces are the interesting part: `incomplete_team` says
 * *how many* more runners the race composition still needs, `member_underage`
 * *names* the member, and `treasury_insufficient` gives the price and the
 * balance, which is why {@link entryRefusalText} exists rather than a bare
 * `t(\`reasons.\${reason}\`)`.
 *
 * **A priced night shows its price and the treasury before the press** (ADR
 * 0013). A manager must never learn that entering costs money by being refused
 * for want of it: each row carries the fee, the section carries the treasury
 * balance, and a treasury that is already short carries the contribute link —
 * the same link the refusal offers — so the fix is one click away whether or
 * not they tried first. The fee is computed on the server through
 * `teamEntryFeeMinor` and arrives as minor units; this island only formats it.
 */

/** One open team event, as this island needs it. */
export type EnterableEvent = {
  slug: string;
  name: string;
  /** Locale-independent display date, `EventSummary.shortDate`. */
  shortDate: string;
  /** The team's existing entry for this event, when there is one. */
  entryId: string | null;
  /**
   * What entering costs, in ACER minor units — `teamEntryFeeMinor(event)` on
   * the server, never the raw column. `0` means free, and renders as such
   * rather than as "0 ACER", which reads like a bug.
   */
  feeMinor: number;
};

/**
 * Turn a refusal into a sentence.
 *
 * `teams.reasons.*` is the frozen per-reason copy shared by all three slices
 * and it cannot interpolate — so the two refusals that carry a datum get their
 * own keys under `teams.entry`, and everything else falls through to the shared
 * set. Exported because `entry-manager-controls.tsx` refuses over the same two
 * reasons (a late recruit can be underage too) and the two islands must not
 * word it differently.
 */
export function entryRefusalText(
  failure: EntryFailure,
  t: (key: string, values?: Record<string, string | number>) => string,
  tReasons: (key: string) => string,
): string {
  if (failure.reason === "incomplete_team" && typeof failure.missing === "number") {
    return t("incompleteDetail", { count: failure.missing });
  }
  if (failure.reason === "member_underage" && failure.memberName) {
    return t("underageDetail", { name: failure.memberName });
  }
  // `teams.reasons.treasury_insufficient` is worded for a payout ("…for this
  // payout"), which is the wrong sentence for an entry — so a priced refusal
  // that carries its two numbers gets the entry's own copy, and the shared key
  // stays the fallback for a refusal that somehow arrived without them.
  if (
    failure.reason === "treasury_insufficient" &&
    typeof failure.feeMinor === "number" &&
    typeof failure.treasuryMinor === "number"
  ) {
    return t("insufficientDetail", {
      needed: minorToAcer(failure.feeMinor),
      balance: minorToAcer(failure.treasuryMinor),
    });
  }
  return tReasons(failure.reason);
}

export function EntryEnterButton({
  teamSlug,
  events,
  locale,
  treasuryMinor,
}: {
  teamSlug: string;
  events: EnterableEvent[];
  /** Needed for the entry-page link, which is built by hand rather than via `Link`. */
  locale: string;
  /**
   * The team treasury in ACER minor units — the same number the treasury
   * section above renders, read once on the page so the two cannot disagree.
   * Shown only when something on the list is actually priced: "Treasury: 0
   * ACER" beside a free night is noise.
   */
  treasuryMinor: number;
}) {
  const t = useTranslations("teams.entry");
  const tReasons = useTranslations("teams.reasons");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [failedSlug, setFailedSlug] = useState<string | null>(null);
  /** The refusal's key, kept beside its sentence: only one of them offers a fix. */
  const [failedReason, setFailedReason] = useState<string | null>(null);
  const [pending, startTransition] = useActionRun(() => setError(tReasons("failed")));

  if (events.length === 0) {
    return (
      <section className="regs-section pf-section" id="enter" data-entry-enter="empty">
        <div className="section-label">
          <span className="iv-eyebrow">{t("heading")}</span>
        </div>
        <div className="regs-empty">{t("noOpenEvents")}</div>
      </section>
    );
  }

  function run(eventSlug: string) {
    if (pending) return;
    setError(null);
    setFailedSlug(null);
    setFailedReason(null);
    startTransition(async () => {
      const result = await enterTeam(teamSlug, eventSlug);
      if (!result.ok) {
        setError(entryRefusalText(result, t, tReasons));
        setFailedSlug(eventSlug);
        setFailedReason(result.reason);
        return;
      }
      // Straight to the entry page: the next thing the captain wants is the
      // checklist of who has confirmed.
      router.push(`/teams/${teamSlug}/entries/${eventSlug}`);
    });
  }

  // Only a priced list gets the money furniture. `anyPriced` gates the section
  // header's treasury line and the refund note; the per-row fee line is shown
  // for every row, free included, because "Free" beside one night and nothing
  // beside another would read as an omission rather than a price.
  const anyPriced = events.some((event) => event.feeMinor > 0);
  const shortFor = events.some((event) => event.entryId === null && event.feeMinor > treasuryMinor);

  return (
    <section className="regs-section pf-section" id="enter" data-entry-enter="1">
      <div className="section-label">
        <span className="iv-eyebrow">{t("heading")}</span>
      </div>
      <p className="pf-block__sub">{t("hint")}</p>

      {anyPriced ? (
        <p className="pf-block__sub" data-entry-treasury={treasuryMinor}>
          {t("treasury", { balance: minorToAcer(treasuryMinor) })}
          {shortFor ? (
            <>
              {" "}
              <a className="iv-linkbtn" href="#treasury" data-entry-topup="1">
                {t("topUp")}
              </a>
            </>
          ) : null}
          <br />
          <span data-entry-refund-note="1">{t("refundNote")}</span>
        </p>
      ) : null}

      <div className="reg-list">
        {events.map((event) => (
          <div key={event.slug} className="reg-card reg-card--plain" data-entry-event={event.slug}>
            <div className="reg-card__body">
              <span className="reg-card__title">{event.name}</span>
              <div className="reg-card__meta">
                <span>{event.shortDate}</span>
                <span data-entry-fee={event.slug} data-entry-fee-minor={event.feeMinor}>
                  {t("feeLabel")}:{" "}
                  {event.feeMinor > 0
                    ? t("fee", { amount: minorToAcer(event.feeMinor) })
                    : t("feeFree")}
                </span>
              </div>
            </div>
            <div className="reg-card__actions">
              {event.entryId ? (
                <>
                  <span className="status status--registered" data-entry-entered={event.slug}>
                    <span className="status__dot" />
                    {t("entered")}
                  </span>
                  <a
                    className="btn btn-sm btn-stroke-dark"
                    href={entryHref(locale, teamSlug, event.slug)}
                    data-entry-action="open"
                  >
                    {t("openEntry")}
                  </a>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-red btn-sm"
                  onClick={() => run(event.slug)}
                  disabled={pending}
                  data-entry-action="enter"
                  data-entry-target={event.slug}
                >
                  {pending ? t("working") : t("enter")}
                </button>
              )}
            </div>
            {error && failedSlug === event.slug ? (
              <span className="field-msg" role="alert" data-entry-error={event.slug}>
                {error}
                {/* A refusal over money is the one refusal with a fix on this
                    very page, so it carries the way there rather than leaving
                    the manager to find the treasury section themselves. */}
                {failedReason === "treasury_insufficient" ? (
                  <>
                    {" "}
                    <a
                      className="iv-linkbtn"
                      href="#treasury"
                      data-entry-topup={event.slug}
                    >
                      {t("topUp")}
                    </a>
                  </>
                ) : null}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The entry page's path.
 *
 * A plain `<a>` rather than `Link` from `@/i18n/navigation`: this row is inside
 * a client island whose parent already knows the locale, and the anchor keeps
 * the button and the link visually identical inside `reg-card__actions`.
 * `localePath` is the same pure helper the actions and the mails use, so the
 * default locale's missing prefix is decided in exactly one place.
 */
function entryHref(locale: string, teamSlug: string, eventSlug: string): string {
  return localePath(locale, `/teams/${teamSlug}/entries/${eventSlug}`);
}
