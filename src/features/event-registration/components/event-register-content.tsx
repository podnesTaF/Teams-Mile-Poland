import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { GuestRegisterForm } from "@/features/event-registration/components/guest-register-form";
import { RegisterConfirm } from "@/features/event-registration/components/register-confirm";
import { getRegistration } from "@/features/event-registration/data";
import { makeEventTicketUrl } from "@/features/event-registration/ticket";
import { ProfileForm } from "@/features/profile/components/profile-form";
import type { ProfileInput } from "@/features/profile/schemas";
import { Link } from "@/i18n/navigation";
import { getEventBySlug } from "@/lib/events/registry";
import { getUser, canRegister } from "@/lib/auth/user-session";
import { coerceToDate, meetsMinParticipantAge, parseDateOnly } from "@/lib/age";
import { defaultLocale } from "@/lib/i18n/config";

/** Serialize a stored DOB (Date via mode:"date", or string) to YYYY-MM-DD. */
function toDateInput(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return "";
}

/**
 * The register-for-event card(s): the passwordless guest form (logged out), the
 * inline profile-completion step, already-registered state, or the confirm
 * form. Served by the full `/events/[slug]/register` page.
 */
export async function EventRegisterContent({ slug, locale }: { slug: string; locale: string }) {
  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") {
    redirect(locale === defaultLocale ? "/" : `/${locale}`);
  }

  const t = await getTranslations("register");

  const user = await getUser();
  if (!user) {
    // Logged-out visitors register right here (passwordless): the guest form
    // creates the account + registration and emails a set-password link. If
    // registration isn't open, show the closed notice instead.
    if (event.status !== "registration_open") {
      return <Notice title={t("closedTitle")} body={t("closedBody")} />;
    }
    return (
      <GuestRegisterForm
        eventSlug={slug}
        eventName={event.name}
        eventDate={event.shortDate}
        eventDateIso={event.date}
        eventTime={event.timeRange ? `${event.timeRange.start}–${event.timeRange.end}` : null}
        venue={`${event.venue}, ${event.city}`}
        locale={locale}
      />
    );
  }

  const existing = await getRegistration(slug, user.id);
  if (existing) {
    return (
      <section className="iv-card center-narrow">
        <span className="iv-eyebrow">{t("alreadyTitle")}</span>
        <p className="iv-sub">{t("alreadyBody")}</p>
        <div className="iv-actions">
          <a href={makeEventTicketUrl(existing.id, { locale })} className="btn btn-red">
            {t("viewTicket")}
          </a>
        </div>
      </section>
    );
  }

  if (event.status !== "registration_open") {
    return <Notice title={t("closedTitle")} body={t("closedBody")} />;
  }
  if (!user.emailVerified) {
    return (
      <Notice
        title={t("verifyTitle")}
        body={t("verifyBody")}
        linkHref="/auth/verify-email"
        linkText={t("verifyCta")}
      />
    );
  }
  if (!canRegister(user)) {
    // Complete the profile inline (no bounce to /profile). Saving returns
    // straight to this page, which then shows the confirm step.
    const pu = user as typeof user & {
      firstName?: string | null;
      lastName?: string | null;
      dateOfBirth?: unknown;
      sex?: "M" | "F" | null;
      club?: string | null;
      phone?: string | null;
    };
    const initial: ProfileInput = {
      firstName: pu.firstName ?? "",
      lastName: pu.lastName ?? "",
      dateOfBirth: toDateInput(pu.dateOfBirth),
      sex: (pu.sex ?? "") as ProfileInput["sex"],
      club: pu.club ?? "",
      phone: pu.phone ?? "",
    };
    return (
      <div className="center-narrow" style={{ maxWidth: 620 }}>
        <div className="page-head" style={{ marginBottom: 16 }}>
          <span className="iv-eyebrow">{t("confirm.eyebrow")}</span>
          <h1 className="iv-title">{t("profileTitle")}</h1>
        </div>
        <div className="banner banner--info" style={{ marginBottom: 16 }}>
          <div className="banner__body">
            <div className="banner__txt">{t("profileBody")}</div>
          </div>
        </div>
        <ProfileForm initial={initial} redirectTo={`/events/${slug}/register`} maxDobAsOf={event.date} />
      </div>
    );
  }

  const dob = coerceToDate((user as { dateOfBirth?: unknown }).dateOfBirth);
  if (!dob || !meetsMinParticipantAge(dob, parseDateOnly(event.date))) {
    return <Notice title={t("ageTitle")} body={t("ageBody")} linkHref="/profile" linkText={t("profileCta")} />;
  }

  const u = user as typeof user & { firstName?: string | null; lastName?: string | null };
  const runnerName =
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || user.name || user.email;

  return (
    <RegisterConfirm
      eventSlug={slug}
      eventName={event.name}
      eventDate={event.shortDate}
      eventTime={event.timeRange ? `${event.timeRange.start}–${event.timeRange.end}` : null}
      venue={`${event.venue}, ${event.city}`}
      runnerName={runnerName}
      runnerEmail={user.email}
    />
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
    <section className="iv-card center-narrow">
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
  );
}
