"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { eventRegistrations } from "@/db/schema";
import { verifyEventTicket } from "@/features/ticket/sign";
import { getUser } from "@/lib/auth/user-session";
import { getDb } from "@/lib/db";
import { defaultLocale, locales, localePath } from "@/lib/i18n/config";

import { confirmRegistration, type ConfirmOutcome } from "./confirmation";

/**
 * The two surfaces that offer the confirm CTA. The return URL is rebuilt from
 * this token server-side rather than accepted as a caller-supplied path, so the
 * action can never be turned into an open redirect.
 */
type Surface = "profile" | "ticket";

function safeLocale(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "");
  return (locales as readonly string[]).includes(raw) ? raw : defaultLocale;
}

/**
 * Confirm attendance for one registration (PRD #26 Contracts).
 *
 * Gated by **either** the owning user session **or** a valid `event-ticket`
 * signature — either alone satisfies it. Guests register passwordlessly
 * (ADR 0002) and may have no password months later when the ask goes out, so
 * putting a sign-in wall in front of a yes/no question would strand them.
 *
 * A signature proves possession of the emailed ticket link for *this* exact
 * registration id, so it cannot be replayed against someone else's row.
 */
export async function confirmAttendance(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  const registrationId = String(formData.get("registrationId") ?? "");
  const sig = String(formData.get("sig") ?? "");
  const surface: Surface = formData.get("surface") === "ticket" ? "ticket" : "profile";

  function back(outcome: ConfirmOutcome | "denied"): never {
    if (surface === "ticket") {
      const path = localePath(
        locale,
        `/tickets/${encodeURIComponent(registrationId)}?s=${encodeURIComponent(sig)}&c=${outcome}#confirm`,
      );
      revalidatePath(localePath(locale, `/tickets/${registrationId}`));
      redirect(path);
    }
    revalidatePath(localePath(locale, "/profile"));
    redirect(localePath(locale, `/profile?c=${outcome}#registrations`));
  }

  if (!registrationId) back("notfound");

  const [row] = await getDb()
    .select({ userId: eventRegistrations.userId })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.id, registrationId))
    .limit(1);

  if (!row) back("notfound");

  const bySignature = Boolean(sig) && verifyEventTicket(registrationId, sig);
  if (!bySignature) {
    const user = await getUser();
    if (!user || user.id !== row.userId) back("denied");
  }

  back(await confirmRegistration(registrationId));
}
