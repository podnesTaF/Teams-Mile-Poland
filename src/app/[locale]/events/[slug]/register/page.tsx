import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { RegisterConfirm } from "@/features/event-registration/components/register-confirm";
import { getRegistration } from "@/features/event-registration/data";
import { makeEventTicketUrl } from "@/features/event-registration/ticket";
import { Link } from "@/i18n/navigation";
import { getEventBySlug } from "@/lib/events/registry";
import { getUser, isProfileComplete } from "@/lib/auth/user-session";
import { defaultLocale } from "@/lib/i18n/config";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function EventRegisterPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") {
    redirect(locale === defaultLocale ? "/" : `/${locale}`);
  }

  const t = await getTranslations("register");

  const user = await getUser();
  if (!user) {
    const target = `/events/${slug}/register`;
    const signIn = `/auth/sign-in?redirectTo=${encodeURIComponent(target)}`;
    redirect(locale === defaultLocale ? signIn : `/${locale}${signIn}`);
  }

  // Already registered → show a link to the existing ticket.
  const existing = await getRegistration(slug, user.id);
  if (existing) {
    return (
      <Shell>
        <section className="iv-card">
          <span className="iv-eyebrow">{t("alreadyTitle")}</span>
          <p className="iv-sub">{t("alreadyBody")}</p>
          <div className="iv-actions">
            <a href={makeEventTicketUrl(existing.id, { locale })} className="btn btn-red">
              {t("viewTicket")}
            </a>
          </div>
        </section>
      </Shell>
    );
  }

  // Gate: closed, unverified, or incomplete profile.
  if (event.status !== "registration_open") {
    return <Notice title={t("closedTitle")} body={t("closedBody")} />;
  }
  if (!user.emailVerified) {
    return (
      <Notice title={t("verifyTitle")} body={t("verifyBody")} linkHref="/auth/verify-email" linkText={t("verifyCta")} />
    );
  }
  if (!isProfileComplete(user)) {
    return (
      <Notice
        title={t("profileTitle")}
        body={t("profileBody")}
        linkHref={`/profile?redirectTo=/events/${slug}/register`}
        linkText={t("profileCta")}
      />
    );
  }

  return (
    <Shell>
      <RegisterConfirm
        eventSlug={slug}
        eventDate={event.shortDate}
        eventTime={event.timeRange ? `${event.timeRange.start}–${event.timeRange.end}` : null}
        venue={`${event.venue}, ${event.city}`}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap iv-wrap--narrow">{children}</div>
      </main>
    </div>
  );
}

function Notice({
  title,
  body,
  linkHref,
  linkText,
}: {
  title: string;
  body: string;
  linkHref?: string;
  linkText?: string;
}) {
  return (
    <Shell>
      <section className="iv-card">
        <span className="iv-eyebrow">{title}</span>
        <p className="iv-sub">{body}</p>
        {linkHref && linkText ? (
          <div className="iv-actions">
            <Link href={linkHref} className="btn btn-red">
              {linkText}
            </Link>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
