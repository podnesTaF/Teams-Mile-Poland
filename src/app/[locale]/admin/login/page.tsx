import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/landing.css";

import { InteriorHeader } from "@/components/landing/interior-header";
import { adminLogin } from "@/features/admin/actions";
import { getAdminSession } from "@/lib/auth/admin-session";
import { defaultLocale } from "@/lib/i18n/config";

export default async function AdminLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const { error } = await searchParams;
  setRequestLocale(locale);

  // Already signed in → go to the dashboard.
  if (await getAdminSession()) {
    redirect(locale === defaultLocale ? "/admin" : `/${locale}/admin`);
  }

  return (
    <div className="ace-landing iv">
      <InteriorHeader />
      <main className="iv-main">
        <div className="iv-wrap iv-wrap--narrow">
          <form action={adminLogin} className="iv-card">
            <input type="hidden" name="locale" value={locale} />
            <span className="iv-eyebrow">Admin</span>
            <h1 className="iv-title">Sign in</h1>
            <p className="iv-sub">Enter the admin password to manage inquiries and registrations.</p>

            {error ? <div className="iv-notice iv-notice--error" style={{ marginTop: 20 }}>Incorrect password.</div> : null}

            <label className="block" style={{ marginTop: 24 }}>
              <span className="iv-fieldlabel">Password</span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="iv-input"
              />
            </label>

            <div className="iv-actions">
              <button type="submit" className="btn btn-red">
                Sign in
                <span aria-hidden>→</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
