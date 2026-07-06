import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";
import "@/app/series-flows.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { LogOutButton } from "@/features/auth/components/log-out-button";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getUserRegistrations } from "@/features/event-registration/data";
import { makeEventTicketUrl } from "@/features/event-registration/ticket";
import { ProfileForm } from "@/features/profile/components/profile-form";
import type { ProfileInput } from "@/features/profile/schemas";
import { getEventBySlug } from "@/lib/events/registry";
import { defaultLocale } from "@/lib/i18n/config";
import { getUser, isProfileComplete } from "@/lib/auth/user-session";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirectTo?: string }>;
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

export default async function ProfilePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { redirectTo } = await searchParams;
  setRequestLocale(locale);

  const user = await getUser();
  if (!user) {
    const dest = `/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo || "/profile")}`;
    redirect(locale === defaultLocale ? dest : `/${locale}${dest}`);
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
  const incomplete = !isProfileComplete(user);

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div className="page-head">
              <span className="iv-eyebrow">{t("eyebrow")}</span>
              <h1 className="iv-title">{t("title")}</h1>
            </div>
            <LogOutButton className="btn btn-stroke-dark btn-sm" />
          </div>

          {incomplete ? (
            <div className="banner banner--info" style={{ marginTop: 20, marginBottom: 20 }}>
              <span className="banner__ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8h.01M11 12h1v4h1" strokeLinecap="round" />
                </svg>
              </span>
              <div className="banner__body">
                <div className="banner__txt">{t("completePrompt")}</div>
              </div>
            </div>
          ) : null}

            <ProfileForm initial={initial} redirectTo={redirectTo} />

          <section className="regs-section">
            <div className="section-label">
              <span className="iv-eyebrow">{t("registrations.title")}</span>
            </div>
            <h2 className="iv-title" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)" }}>
              {t("registrations.heading")}
            </h2>

            {registrations.length === 0 ? (
              <div className="regs-empty">{t("registrations.empty")}</div>
            ) : (
              <div className="reg-list">
                {registrations.map((reg) => {
                  const event = getEventBySlug(reg.eventSlug);
                  const active = reg.status === "registered" || reg.status === "checked_in";
                  const [y, m, d] = (event?.date ?? "").split("-");
                  const day = d ? String(parseInt(d, 10)) : reg.eventSlug;
                  const month = m ? MONTHS[parseInt(m, 10) - 1] ?? "" : "";
                  return (
                    <div key={reg.id} className="reg-card" data-state={active ? "registered" : "completed"}>
                      <div className="race-date">
                        <span className="race-date__d">{day}</span>
                        {month ? <span className="race-date__m">{month}</span> : null}
                        {y ? <span className="race-date__y">{y}</span> : null}
                      </div>
                      <div className="reg-card__body">
                        <span className="reg-card__title">{event?.name ?? reg.eventSlug}</span>
                        <div className="reg-card__meta">
                          <span>
                            {reg.bib
                              ? `${t("registrations.bib")} #${reg.bib}`
                              : t("registrations.bibPending")}
                          </span>
                        </div>
                      </div>
                      <div className="reg-card__actions">
                        <span className={`status ${active ? "status--registered" : "status--completed"}`}>
                          <span className="status__dot" />
                          {t(`registrations.status.${reg.status}`)}
                        </span>
                        {active ? (
                          <a className="btn btn-red btn-sm" href={makeEventTicketUrl(reg.id, { locale })}>
                            {t("registrations.ticket")}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
