import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { ProfileForm } from "@/features/profile/components/profile-form";
import type { ProfileInput } from "@/features/profile/schemas";
import { TEAM_CREATION_PRICE_ACER } from "@/features/wallet/config";
import { getAcerBalance } from "@/features/wallet/data";
import { isAcerPurchaseEnabled } from "@/features/wallet/purchase";
import { Link } from "@/i18n/navigation";
import type { SessionUser } from "@/lib/auth/user-session";
import { localePath } from "@/lib/i18n/config";

import { teamGateState } from "../guards";
import { TeamForm } from "./team-form";

/** The path the whole gate chain returns to. */
export const CREATE_TEAM_PATH = "/teams/new";

/** Serialize a stored DOB (Date via mode:"date", or string) to YYYY-MM-DD. */
function toDateInput(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return "";
}

/**
 * `/teams/new` past the signed-out redirect: the unverified, incomplete-profile
 * and under-18 states, then the form.
 *
 * The incomplete-profile state completes the profile **inline** with
 * `redirectTo` back here, the same round-trip the event register flow uses —
 * bouncing a would-be manager to `/profile` and hoping they come back loses
 * them. Age is checked against **today** (`teamGateState`), not an event date.
 *
 * The form's last gate is money: founding a team costs
 * `TEAM_CREATION_PRICE_ACER`, so the balance is read here and handed down. It is
 * shown rather than enforced — the refusal that counts is the one `createTeam`
 * makes inside its transaction.
 */
export async function TeamNewContent({ user, locale }: { user: SessionUser; locale: string }) {
  const t = await getTranslations("teams.form");
  const state = teamGateState(user);

  if (state === "verify") {
    return (
      <Notice state="verify" title={t("verifyTitle")} body={t("verifyBody")}>
        <Link className="btn btn-red" href="/auth/verify-email">
          {t("verifyCta")}
        </Link>
      </Notice>
    );
  }

  if (state === "profile") {
    const pu = user as SessionUser & {
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
      <div className="center-narrow" style={{ maxWidth: 620 }} data-team-gate="profile">
        <div className="page-head" style={{ marginBottom: 16 }}>
          <span className="iv-eyebrow">{t("eyebrow")}</span>
          <h1 className="iv-title">{t("profileTitle")}</h1>
        </div>
        <div className="banner banner--info" style={{ marginBottom: 16 }}>
          <div className="banner__body">
            <div className="banner__txt">{t("profileBody")}</div>
          </div>
        </div>
        <ProfileForm initial={initial} redirectTo={CREATE_TEAM_PATH} />
      </div>
    );
  }

  if (state === "age") {
    return (
      <Notice state="age" title={t("ageTitle")} body={t("ageBody")}>
        <Link className="btn btn-stroke-dark" href="/profile">
          {t("profileCta")}
        </Link>
      </Notice>
    );
  }

  // Only past the gates: a runner who cannot create a team yet is owed the step
  // they are missing, not a price. The balance is a plain read of the ledger —
  // what the form shows is display only, and the action reads it again under a
  // lock before it charges anything.
  const balanceMinor = await getAcerBalance(user.id);

  return (
    <div className="center-narrow" style={{ maxWidth: 620 }} data-team-gate="ok">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <span className="iv-eyebrow">{t("eyebrow")}</span>
        <h1 className="iv-title">{t("createTitle")}</h1>
        <p className="iv-sub">{t("createSubtitle")}</p>
      </div>
      <TeamForm
        mode="create"
        rulesHref={localePath(locale, "/legal/team-rules")}
        priceAcer={TEAM_CREATION_PRICE_ACER}
        balanceMinor={balanceMinor}
        // Resolved on the server because the flag is deliberately not
        // `NEXT_PUBLIC_` (see `purchase.ts`): the wallet link may only offer a
        // top-up when there is something to buy with.
        purchaseEnabled={isAcerPurchaseEnabled()}
      />
    </div>
  );
}

function Notice({
  state,
  title,
  body,
  children,
}: {
  state: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section className="iv-card center-narrow" data-team-gate={state}>
      <span className="iv-eyebrow">{title}</span>
      <p className="iv-sub">{body}</p>
      <div className="iv-actions">{children}</div>
    </section>
  );
}
