import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { ManagementHandedOverEmail } from "@/features/teams/emails/management-handed-over";
import { RemovedFromTeamEmail } from "@/features/teams/emails/removed-from-team";
import { TeamDissolvedEmail } from "@/features/teams/emails/team-dissolved";
import { appAbsoluteUrl } from "@/lib/app-url";
import { localePath } from "@/lib/i18n/config";

import {
  asTeamMailLocale,
  sendTeamMail,
  teamMailFacts,
  type Translate,
} from "./mail-invitations";
import type { TeamMailRecipient } from "./roster-service";

/**
 * The three roster-change emails (#62): removed from team, management handed
 * over, team dissolved. Sent inline from `actions/roster.ts`, one recipient at
 * a time, in that account's own language.
 *
 * Transport, locale narrowing and the team-facts block all come from
 * `mail-invitations.ts`: there is **one** `sendTeamMail` for the whole feature,
 * so every team mail logs the same `[teams] mail skipped/failed` line and the
 * "Resend returns `{ error }` rather than throwing" trap is handled in one
 * place. (#62 shipped its own copy of that helper because #60's did not exist in
 * its worktree; #61 folded it back in.)
 *
 * Copy is resolved here, not in the templates: a React Email component is
 * rendered synchronously by Resend, so it cannot await `getTranslations`.
 */

/**
 * The team fields these emails name. Widened from slug + name when the three
 * templates moved onto the shared shell, which shows the category and region
 * with them — `actions/roster.ts` already passes a whole `UserTeamRow` (for
 * dissolve, the row captured before the delete), so no caller changed.
 */
export type TeamMailTeam = Pick<UserTeamRow, "slug" | "name" | "category" | "region">;

/** Sent to the runner a manager (or an admin) removed from a roster. */
export async function sendRemovedFromTeamMail(
  recipient: TeamMailRecipient,
  team: TeamMailTeam,
): Promise<boolean> {
  const locale = asTeamMailLocale(recipient.locale);
  const t = (await getTranslations({ locale, namespace: "teams.emails.removed" })) as Translate;
  const { facts, labels } = await teamMailFacts(locale, team, t);

  return sendTeamMail({
    to: recipient.email,
    locale,
    subject: t("subject", { team: team.name }),
    react: RemovedFromTeamEmail({
      preview: t("preview", { team: team.name }),
      eyebrow: t("eyebrow"),
      title: t("title"),
      greeting: t("greeting", { name: recipient.firstName }),
      intro: t("intro", { team: team.name }),
      outro: t("outro"),
      team: facts,
      labels,
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
  const t = (await getTranslations({ locale, namespace: "teams.emails.handedOver" })) as Translate;
  const { facts, labels } = await teamMailFacts(locale, team, t);

  return sendTeamMail({
    to: recipient.email,
    locale,
    subject: t("subject", { team: team.name }),
    react: ManagementHandedOverEmail({
      preview: t("preview", { team: team.name }),
      eyebrow: t("eyebrow"),
      title: t("title"),
      greeting: t("greeting", { name: recipient.firstName }),
      intro: t("intro", { team: team.name }),
      dutiesTitle: t("dutiesTitle"),
      duties: [t("duty1"), t("duty2"), t("duty3")],
      team: facts,
      labels,
      ctaLabel: t("cta"),
      ctaHref: appAbsoluteUrl(localePath(locale, `/teams/${team.slug}`)),
    }),
  });
}

/**
 * Sent to every remaining member of a dissolved team. The team row is already
 * gone by the time this runs, so the facts are passed in rather than looked up.
 */
export async function sendTeamDissolvedMail(
  recipient: TeamMailRecipient,
  team: TeamMailTeam,
): Promise<boolean> {
  const locale = asTeamMailLocale(recipient.locale);
  const t = (await getTranslations({ locale, namespace: "teams.emails.dissolved" })) as Translate;
  const { facts, labels } = await teamMailFacts(locale, team, t);

  return sendTeamMail({
    to: recipient.email,
    locale,
    subject: t("subject", { team: team.name }),
    react: TeamDissolvedEmail({
      preview: t("preview", { team: team.name }),
      eyebrow: t("eyebrow"),
      title: t("title"),
      greeting: t("greeting", { name: recipient.firstName }),
      intro: t("intro", { team: team.name }),
      outro: t("outro"),
      team: facts,
      labels,
      cta: { label: t("cta"), href: appAbsoluteUrl(localePath(locale, "/teams/new")) },
    }),
  });
}
