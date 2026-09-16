import { getTranslations } from "next-intl/server";

import type { UserTeamRow } from "@/db/schema/user-teams";
import { getAppUrl } from "@/lib/app-url";
import { localePath } from "@/lib/i18n/config";

import { TeamJoinRequestDecidedEmail } from "./emails/join-request-decided";
import { TeamJoinRequestReceivedEmail } from "./emails/join-request-received";
import {
  sendTeamMail,
  teamMailFacts,
  type TeamMailLocale,
  type Translate,
} from "./mail-invitations";

/**
 * The two join-request emails (#61): **received** to the manager when a runner
 * knocks, **decided** to the runner when the manager answers.
 *
 * Transport, locale narrowing and the team-facts block all come from
 * `mail-invitations.ts` — there is one `sendTeamMail` for the whole feature, so
 * the `[teams] mail skipped/failed` lines a verification run asserts on have one
 * shape. What lives here is only which catalog is read and which link the button
 * carries.
 *
 * Both are read in the **recipient's** locale (`users.locale`), never the
 * request locale: a Ukrainian runner asking to join a Polish manager's team must
 * get their answer in Ukrainian, and the manager must get the knock in Polish.
 */

/**
 * "<runner> asked to join <team>" to the manager.
 *
 * The button goes to `/teams/<slug>#manage`, where the queue is: the mail exists
 * to get a decision made, so it lands on the thing that decides rather than on
 * the public card.
 */
export async function sendJoinRequestReceivedEmail({
  to,
  locale,
  team,
  runnerName,
  count,
}: {
  to: string;
  locale: TeamMailLocale;
  team: UserTeamRow;
  /** The requester's display name — a manager decides about a person. */
  runnerName: string;
  /** The roster size as it stands — a plain count, never "x of N". */
  count: number;
}): Promise<boolean> {
  const t = (await getTranslations({
    locale,
    namespace: "teams.emails.requestReceived",
  })) as Translate;
  const { facts, labels } = await teamMailFacts(locale, team, t);
  const url = `${getAppUrl()}${localePath(locale, `/teams/${team.slug}`)}#manage`;

  return sendTeamMail({
    to,
    locale,
    subject: t("subject", { name: runnerName, team: team.name }),
    react: TeamJoinRequestReceivedEmail({
      url,
      team: facts,
      copy: {
        preview: t("preview", { name: runnerName, team: team.name }),
        eyebrow: t("eyebrow"),
        title: t("title", { name: runnerName }),
        body: t("body", { name: runnerName, team: team.name }),
        roster: t("roster", { count }),
        intro: t("intro"),
        cta: t("cta"),
        labels,
      },
    }),
  });
}

/**
 * The manager's answer to the runner. `accepted` picks the variant — same
 * envelope, different sentences and a different destination: the team when they
 * are on it, the public recruiting list when they are not, because a runner who
 * has just been turned down needs somewhere to go next.
 *
 * `count` is only read by the accepted variant.
 */
export async function sendJoinRequestDecidedEmail({
  to,
  locale,
  team,
  firstName,
  accepted,
  count,
}: {
  to: string;
  locale: TeamMailLocale;
  team: UserTeamRow;
  /** The runner's first name, for the greeting. */
  firstName: string;
  accepted: boolean;
  /** The roster size after the accept — a plain count, never "x of N". */
  count: number;
}): Promise<boolean> {
  const t = (await getTranslations({
    locale,
    namespace: "teams.emails.requestDecided",
  })) as Translate;
  const { facts, labels } = await teamMailFacts(locale, team, t);
  const url = `${getAppUrl()}${localePath(locale, accepted ? `/teams/${team.slug}` : "/teams")}`;

  return sendTeamMail({
    to,
    locale,
    subject: accepted
      ? t("subjectAccepted", { team: team.name })
      : t("subjectDeclined", { team: team.name }),
    react: TeamJoinRequestDecidedEmail({
      url,
      accepted,
      team: facts,
      copy: {
        preview: accepted
          ? t("previewAccepted", { team: team.name })
          : t("previewDeclined", { team: team.name }),
        eyebrow: t("eyebrow"),
        title: accepted ? t("titleAccepted") : t("titleDeclined"),
        greeting: t("greeting", { name: firstName }),
        body: accepted
          ? t("bodyAccepted", { team: team.name })
          : t("bodyDeclined", { team: team.name }),
        roster: accepted ? t("roster", { count }) : undefined,
        outro: accepted ? t("outroAccepted") : t("outroDeclined"),
        cta: accepted ? t("ctaAccepted") : t("ctaDeclined"),
        labels,
      },
    }),
  });
}
