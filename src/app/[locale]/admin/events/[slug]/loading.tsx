/**
 * Tab-content fallback for one event's pages.
 *
 * It sits below the event layout, so switching between Roster, Heats and
 * Check-in keeps the sidebar, topbar, event header and the tab bar — with the
 * tab you pressed already highlighted — and shimmers only the panel underneath.
 */
export default function AdminEventTabLoading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="h-10 animate-pulse rounded-admin border border-admin-line bg-admin-surface" />
      <div className="mt-4 h-96 animate-pulse rounded-admin-lg border border-admin-line bg-admin-surface" />
    </div>
  );
}
