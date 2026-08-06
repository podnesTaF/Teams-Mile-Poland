import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * A counter tile in the Tailwind admin layer — what `Stat` (`.iv-info`) is on
 * the not-yet-redesigned pages (ADR 0004).
 *
 * Sized to work both nested inside a card (the events index's two-up counts) and
 * standing on the canvas (the dashboard's secondary row). `href` turns the tile
 * into a link to the page its counter belongs to, which is how that row doubles
 * as navigation.
 */

const TILE =
  "flex flex-col gap-1.5 rounded-admin border border-admin-line bg-admin-surface-2 px-3.5 py-3";

export function AdminStat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-admin-muted">
        {label}
      </p>
      <p className="font-sans text-[22px] font-semibold normal-case not-italic leading-none tracking-[-0.02em] text-admin-ink">
        {value}
      </p>
      {hint ? <p className="text-[12px] leading-tight text-admin-muted">{hint}</p> : null}
    </>
  );

  if (!href) return <div className={TILE}>{body}</div>;

  return (
    <Link
      href={href}
      className={cn(TILE, "transition-colors hover:border-admin-line-2 hover:bg-admin-surface")}
    >
      {body}
    </Link>
  );
}
