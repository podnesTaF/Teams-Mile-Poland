import type { ReactElement } from "react";
import { getTranslations } from "next-intl/server";

import { ManagementHandedOverEmail } from "@/features/teams/emails/management-handed-over";
import { RemovedFromTeamEmail } from "@/features/teams/emails/removed-from-team";
import { TeamDissolvedEmail } from "@/features/teams/emails/team-dissolved";
import { appAbsoluteUrl } from "@/lib/app-url";
import { FROM_EMAIL, resend } from "@/lib/email";
import { localePath } from "@/lib/i18n/config";

import type { TeamMailRecipient } from "./roster-service";

/**
 * The three roster-change emails (#62): removed from team, management handed
 * over, team dissolved. Sent inline from `actions/roster.ts`, one recipient at
 * a time, in that account's own language.
 *
 * Deliberately small and self-contained: #60 owns the shared team-mail shell
 * and its own `mail-invitations.ts`, and the two slices were built in parallel.
 * Reconciling is a swap of {@link sendTeamRosterMail}'s body for that helper.
 *
 * Copy is resolved here, not in the templates: a React Email component is
 * rendered synchronously by Resend, so it cannot await `getTranslations`.
 */

export type TeamMailLocale = "pl" | "en" | "ua";

/** `users.locale` is free text; anything unexpected reads Polish, the default. */
export function asTeamMailLocale(value: string | null | undefined): TeamMailLocale {
  return value === "pl" || value === "en" || value === "ua" ? value : "pl";
}

/**
 * One send, null-safe and honest about the outcome.
 *
 * Resend's `send()` reports API failures in the returned `error` and does not
 * throw, so an unchecked call logs a success for mail that never left (the
 * standing pitfall in this codebase). Both branches log with the `[teams]`
 * prefix so a verification run can assert on the line without a mail account.
 *
 * Returns `true` only when Resend accepted the message.
 */
export async function sendTeamRosterMail(args: {
  /** Template name, for the log line only. */
  kind: "removed" | "handedOver" | "dissolved";
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<boolean> {
  if (!resend) {
    console.log(`[teams] mail skipped (no RESEND_API_KEY) ${args.kind} → ${args.to}`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: args.subject,
      react: args.react,
    });
    if (error) {
      console.error(`[teams] mail failed ${args.kind} → ${args.to}: ${error.message}`);
      return false;
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[teams] mail failed ${args.kind} → ${args.to}: ${message}`);
    return false;
  }
}

/** The team fields every one of these emails names. */
export type TeamMailTeam = { slug: string; name: string };

/** Sent to the runner a manager (or an admin) removed from a roster. */
export async function sendRemovedFromTeamMail(
  recipient: TeamMailRecipient,
  team: TeamMailTeam,
): Promise<boolean> {
  const locale = asTeamMailLocale(recipient.locale);
  const t = await getTranslations({ locale, namespace: "teams.emails.removed" });

  return sendTeamRosterMail({
    kind: "removed",
    to: recipient.email,
    subject: t("subject", { team: team.name }),
    react: RemovedFromTeamEmail({
      preview: t("preview", { team: team.name }),
      eyebrow: t("eyebrow"),
      title: t("title"),
      greeting: t("greeting", { name: recipient.firstName }),
      intro: t("intro", { team: team.name }),
      teamLabel: t("teamLabel"),
      teamName: team.name,
      outro: t("outro"),
      cta: { label: t("cta"), href: appAbsoluteUrl(localePath(locale, "/teams/new")) },
    }),
  });
}

/** Sent to the new manager. The outgoing one pressed the button and is not mailed. */
export async function sendManagementHandedOverMail(
  recipient: TeamMailRecipient,
  team: TeamMailTeam,
): Promise<boolean> {
  const locale = asTeamMailLocale(recipient.locale);
  const t = await getTranslations({ locale, namespace: "teams.emails.handedOver" });

  return sendTeamRosterMail({
    kind: "handedOver",
    to: recipient.email,
    subject: t("subject", { team: team.name }),
    react: ManagementHandedOverEmail({
      preview: t("preview", { team: team.name }),
      eyebrow: t("eyebrow"),
      title: t("title"),
      greeting: t("greeting", { name: recipient.firstName }),
      intro: t("intro", { team: team.name }),
      teamLabel: t("teamLabel"),
      teamName: team.name,
      dutiesTitle: t("dutiesTitle"),
      duties: [t("duty1"), t("duty2"), t("duty3")],
      ctaLabel: t("cta"),
      ctaHref: appAbsoluteUrl(localePath(locale, `/teams/${team.slug}`)),
    }),
  });
}

/**
 * Sent to every remaining member of a dissolved team. The team row is already
 * gone by the time this runs, so the name is passed in rather than looked up.
 */
export async function sendTeamDissolvedMail(
  recipient: TeamMailRecipient,
  team: TeamMailTeam,
): Promise<boolean> {
  const locale = asTeamMailLocale(recipient.locale);
  const t = await getTranslations({ locale, namespace: "teams.emails.dissolved" });

  return sendTeamRosterMail({
    kind: "dissolved",
    to: recipient.email,
    subject: t("subject", { team: team.name }),
    react: TeamDissolvedEmail({
      preview: t("preview", { team: team.name }),
      eyebrow: t("eyebrow"),
      title: t("title"),
      greeting: t("greeting", { name: recipient.firstName }),
      intro: t("intro", { team: team.name }),
      teamLabel: t("teamLabel"),
      teamName: team.name,
      outro: t("outro"),
      cta: { label: t("cta"), href: appAbsoluteUrl(localePath(locale, "/teams/new")) },
    }),
  });
}
