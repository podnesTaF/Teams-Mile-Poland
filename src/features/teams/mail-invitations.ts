import type { ReactElement } from "react";
import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { getAppUrl } from "@/lib/app-url";
import { FROM_EMAIL, resend } from "@/lib/email";
import { defaultLocale, locales, localePath, type Locale } from "@/lib/i18n/config";

import { TeamInvitationAcceptedEmail } from "./emails/invitation-accepted";
import { TeamInvitationEmail } from "./emails/invitation";
import type { TeamMailFacts, TeamMailLabels } from "./emails/shell";

/**
 * Team mail: the shared transport plus the two invitation templates (#60).
 *
 * `sendTeamMail` is the transport every team slice uses (#61 requests, #62
 * roster changes) — it is here rather than in `src/lib/email` because the
 * `[teams]` log prefix and the "never assume a send succeeded" rule are this
 * feature's contract, not the whole app's.
 *
 * Copy is read **per recipient**, from `teams.emails.*` in that person's own
 * locale (`users.locale`), never from the request locale: a Polish manager
 * inviting a Ukrainian runner must not mail them Polish. Templates therefore
 * receive resolved strings, not message keys.
 */

export type TeamMailLocale = Locale;

/** Narrow a stored `users.locale` (or a route param) to a catalog we have. */
export function asTeamMailLocale(value: string | null | undefined): TeamMailLocale {
  return (locales as readonly string[]).includes(value ?? "")
    ? (value as TeamMailLocale)
    : defaultLocale;
}

/**
 * Send one team email.
 *
 * Returns whether it actually went out — **never throws**, because a mail
 * failure must not roll back a roster change that already happened.
 *
 * Two things this is careful about, both of them known traps here:
 *  - `resend` is `null` when `RESEND_API_KEY` is absent (local runs, verify
 *    scripts). That is a *skip*, logged as one, not a failure.
 *  - Resend's `send()` **returns** `{ error }` and does not throw, so the
 *    unchecked idiom logs failed sends as successes. The error is checked.
 */
export async function sendTeamMail({
  to,
  locale,
  subject,
  react,
}: {
  to: string;
  locale: TeamMailLocale;
  subject: string;
  react: ReactElement;
}): Promise<boolean> {
  if (!resend) {
    console.warn(`[teams] mail skipped (no RESEND_API_KEY) — "${subject}" to ${to} [${locale}]`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, react });
    if (error) {
      console.error(`[teams] mail failed — "${subject}" to ${to} [${locale}]:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[teams] mail failed — "${subject}" to ${to} [${locale}]:`, error);
    return false;
  }
}

/** Just enough of a next-intl translator for the shared bits below. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * The team facts and their field labels, in the recipient's locale. Every team
 * mail repeats this block, and `teamLabel` / `categoryLabel` / `regionLabel`
 * live in each template's own catalog object so no template depends on another's
 * keys.
 *
 * Exported so the join-request mails (#61) and the roster mails (#62) build the
 * block the same way rather than each growing their own copy — the `t` they pass
 * is their own namespace's translator, which is what keeps the catalogs separate.
 */
export async function teamMailFacts(
  locale: TeamMailLocale,
  team: Pick<UserTeamRow, "name" | "category" | "region">,
  t: Translate,
): Promise<{ facts: TeamMailFacts; labels: TeamMailLabels }> {
  const tForm = (await getTranslations({ locale, namespace: "teams.form" })) as Translate;
  return {
    facts: {
      name: team.name,
      category: tForm(`categoryOption.${team.category}`),
      region: team.region,
    },
    labels: { team: t("teamLabel"), category: t("categoryLabel"), region: t("regionLabel") },
  };
}

/** BCP-47 tag per app locale — `ua` is the app's code, `uk-UA` is the real tag. */
const DATE_TAG: Record<TeamMailLocale, string> = { pl: "pl-PL", en: "en-GB", ua: "uk-UA" };

/** An expiry date as the reader's locale writes it, pinned to Warsaw. */
export function formatTeamDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(DATE_TAG[asTeamMailLocale(locale)], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  }).format(date);
}

/**
 * The invitation mail. `onBehalf` picks the organiser variant — same row, same
 * link, different sentence (PRD #57, "Admin invites on the team's behalf").
 */
export async function sendInvitationEmail({
  to,
  locale,
  team,
  inviterName,
  onBehalf,
  rawToken,
  expiresAt,
}: {
  to: string;
  locale: TeamMailLocale;
  team: UserTeamRow;
  /** The manager's display name; ignored by the on-behalf variant. */
  inviterName: string;
  onBehalf: boolean;
  rawToken: string;
  expiresAt: Date;
}): Promise<boolean> {
  const t = (await getTranslations({
    locale,
    namespace: "teams.emails.invitation",
  })) as Translate;
  const { facts, labels } = await teamMailFacts(locale, team, t);
  const url = `${getAppUrl()}${localePath(locale, `/teams/invite/${rawToken}`)}`;

  return sendTeamMail({
    to,
    locale,
    subject: onBehalf
      ? t("subjectOnBehalf", { team: team.name })
      : t("subject", { team: team.name }),
    react: TeamInvitationEmail({
      onBehalf,
      url,
      team: facts,
      copy: {
        preview: t("preview", { team: team.name }),
        eyebrow: t("eyebrow"),
        title: t("title", { team: team.name }),
        greeting: t("greeting"),
        body: t("body", { inviter: inviterName, team: team.name }),
        bodyOnBehalf: t("bodyOnBehalf", { team: team.name }),
        intro: t("intro"),
        cta: t("cta"),
        expiry: t("expiry", { date: formatTeamDate(expiresAt, locale) }),
        ignore: t("ignore"),
        labels,
      },
    }),
  });
}

/** "<runner> joined <team>" to the manager, after an accept lands. */
export async function sendInvitationAcceptedEmail({
  to,
  locale,
  team,
  memberName,
  count,
}: {
  to: string;
  locale: TeamMailLocale;
  team: UserTeamRow;
  memberName: string;
  /** The roster size after the accept — shown as a plain count, never "x of N". */
  count: number;
}): Promise<boolean> {
  const t = (await getTranslations({
    locale,
    namespace: "teams.emails.invitationAccepted",
  })) as Translate;
  const { facts, labels } = await teamMailFacts(locale, team, t);
  const url = `${getAppUrl()}${localePath(locale, `/teams/${team.slug}`)}`;

  return sendTeamMail({
    to,
    locale,
    subject: t("subject", { name: memberName, team: team.name }),
    react: TeamInvitationAcceptedEmail({
      url,
      team: facts,
      copy: {
        preview: t("preview", { name: memberName, team: team.name }),
        eyebrow: t("eyebrow"),
        title: t("title", { name: memberName }),
        body: t("body", { name: memberName, team: team.name }),
        roster: t("roster", { count }),
        cta: t("cta"),
        labels,
      },
    }),
  });
}
