import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import {
  CREATE_TEAM_PATH,
  TeamNewContent,
} from "@/features/teams/components/team-new-content";
import { Link } from "@/i18n/navigation";
import { getUser } from "@/lib/auth/user-session";
import { defaultLocale } from "@/lib/i18n/config";

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Create a team. Dynamic: it reads the session on every request.
 *
 * The signed-out arm redirects the same way the profile page does — to
 * `/auth/sign-in?redirectTo=/teams/new`, locale-prefixed by hand because
 * `next/navigation`'s `redirect` does not know about next-intl. The sign-in
 * page carries the `redirectTo` on to sign-up, verification and the profile
 * form, so intent survives the whole chain. Every state after that
 * (unverified, incomplete profile, under 18) renders in place — see
 * `TeamNewContent`.
 */
export default async function NewTeamPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getUser();
  if (!user) {
    const dest = `/auth/sign-in?redirectTo=${encodeURIComponent(CREATE_TEAM_PATH)}`;
    redirect(locale === defaultLocale ? dest : `/${locale}${dest}`);
  }

  const t = await getTranslations("teams.form");

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <Link href="/profile" className="detail-back">
            ← {t("back")}
          </Link>
          <TeamNewContent user={user} locale={locale} />
        </div>
      </main>
    </div>
  );
}
