import Link from "next/link";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";

export const metadata = { title: "Panel administratora — ACE BATTLE RUN" };

/**
 * Powłoka dla WSZYSTKICH zalogowanych stron panelu administratora.
 * Sama ochrona dostępu (sprawdzenie kodu) dzieje się wcześniej,
 * w middleware.ts — ten layout zakłada, że request już przeszedł
 * przez middleware i nie duplikuje tej logiki.
 */
export default function AdminAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-bg font-body text-brand-text">
      <header className="no-print sticky top-0 z-40 border-b border-brand-border bg-brand-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="font-display text-lg uppercase tracking-tight">
              ACE BATTLE RUN
            </span>
            <span className="eyebrow">Panel administratora</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-semibold uppercase tracking-wide text-brand-textMuted">
            <Link href="/admin" className="transition-colors hover:text-brand-text">
              Zgłoszenia
            </Link>
            <Link
              href="/admin/events"
              className="transition-colors hover:text-brand-text"
            >
              Wydarzenia
            </Link>
            <Link
              href="/admin/documents/regulamin"
              className="transition-colors hover:text-brand-text"
            >
              Dokumenty wewnętrzne
            </Link>
            <AdminLogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
