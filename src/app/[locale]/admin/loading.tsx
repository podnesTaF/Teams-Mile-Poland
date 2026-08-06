import { AdminMenuButton } from "@/features/admin/components/shell/admin-menu-button";

/**
 * Admin navigation fallback. The layout — and with it the sidebar — stays
 * mounted, so only the topbar and content column shimmer while the next page's
 * data resolves.
 *
 * The drawer toggle is the real control, not a shimmer: on a phone the nav has
 * to stay openable while a page is still loading. Shapes below it mirror
 * `AdminPage`'s content column so the swap-in doesn't jump.
 */
export default function AdminLoading() {
  return (
    <>
      <div className="sticky top-0 z-30 border-b border-admin-line bg-admin-surface">
        <div className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <AdminMenuButton />
          <div className="h-4 w-40 animate-pulse rounded bg-admin-surface-2" />
          <div className="ml-auto h-8 w-24 animate-pulse rounded-admin bg-admin-surface-2" />
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 pt-6 sm:px-6"
        role="status"
        aria-label="Loading"
      >
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-admin-lg border border-admin-line bg-admin-surface"
            />
          ))}
        </div>
        <div className="mt-5 h-64 animate-pulse rounded-admin-lg border border-admin-line bg-admin-surface" />
      </div>
    </>
  );
}
