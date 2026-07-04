import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getUserRegistrations } from "@/features/event-registration/data";
import { makeEventTicketUrl } from "@/features/event-registration/ticket";
import { ProfileForm } from "@/features/profile/components/profile-form";
import type { ProfileInput } from "@/features/profile/schemas";
import { getEventBySlug } from "@/lib/events/registry";
import { defaultLocale } from "@/lib/i18n/config";
import { getUser, isProfileComplete } from "@/lib/auth/user-session";

type PageProps = {
  params: Promise<{ locale: string }>;
};

/** Serialize a stored DOB (Date via mode:"date", or string) to YYYY-MM-DD. */
function toDateInput(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return "";
}

export default async function ProfilePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getUser();
  if (!user) {
    const signIn = "/auth/sign-in?redirectTo=/profile";
    redirect(locale === defaultLocale ? signIn : `/${locale}${signIn}`);
  }

  const u = user as typeof user & {
    firstName?: string | null;
    lastName?: string | null;
    dateOfBirth?: unknown;
    sex?: "M" | "F" | null;
    club?: string | null;
    phone?: string | null;
  };

  const initial: ProfileInput = {
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    dateOfBirth: toDateInput(u.dateOfBirth),
    sex: (u.sex ?? "") as ProfileInput["sex"],
    club: u.club ?? "",
    phone: u.phone ?? "",
  };

  const t = await getTranslations("profile");
  const registrations = await getUserRegistrations(user.id);

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap iv-wrap--narrow">
          <ProfileForm initial={initial} incomplete={!isProfileComplete(user)} />

          <section className="iv-card" style={{ marginTop: 20 }}>
            <span className="iv-eyebrow">{t("registrations.title")}</span>
            {registrations.length === 0 ? (
              <p className="iv-sub">{t("registrations.empty")}</p>
            ) : (
              <ul className="ev-reglist">
                {registrations.map((reg) => {
                  const event = getEventBySlug(reg.eventSlug);
                  const active = reg.status === "registered" || reg.status === "checked_in";
                  return (
                    <li key={reg.id} className="ev-reglist__row">
                      <div>
                        <div className="ev-reglist__date">{event?.shortDate ?? reg.eventSlug}</div>
                        <div className="ev-reglist__meta">
                          {t(`registrations.status.${reg.status}`)}
                          {reg.bib ? ` · #${reg.bib}` : ""}
                        </div>
                      </div>
                      {active ? (
                        <a
                          className="iv-linkbtn"
                          href={makeEventTicketUrl(reg.id, { locale })}
                        >
                          {t("registrations.ticket")}
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
