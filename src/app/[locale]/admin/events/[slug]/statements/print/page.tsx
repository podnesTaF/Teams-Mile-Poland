import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import "@/app/series-flows.css";
import "@/app/[locale]/events/[slug]/legal/legal.css";

import { requireAdmin } from "@/features/admin/action-helpers";
import { PrintStatementsButton } from "@/features/admin/components/print-statements-button";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { AdminNotice } from "@/features/admin/components/shell/admin-notice";
import {
  getStatementsForPrint,
  type PrintedStatement,
} from "@/features/admin/statements";
import { Link } from "@/i18n/navigation";
import { locales } from "@/lib/i18n/config";
import type { DocLocale } from "@/lib/legal/manifest";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ ids?: string | string[]; lang?: string | string[] }>;
};

/**
 * The print surface: `?ids=<comma list>&lang=<pl|en|ua>`.
 *
 * One `.print-area` holding every requested Statement in sequence, each after
 * the first preceded by a `.legal-page-break` so the browser's print / save-as-
 * PDF dialog produces one sheet per runner. Everything else on the page — the
 * admin shell above it and this page's own toolbar — is `.no-print` or hidden by
 * `legal.css`'s print rules, so what comes out of the dialog is the document and
 * nothing else.
 *
 * The query is the whole selection API, which is what lets #55 add roster
 * selection without touching this page: it already takes a list.
 *
 * `lang` is optional and applies to the batch. Omitted, each Statement renders
 * in the locale its own submission recorded — a mixed-language field prints as a
 * mixed-language batch, which is correct: the recorded language is the operative
 * text and a convenience translation is not.
 */

const IDS_LIMIT = 200;

/**
 * A registration id is a uuid. Anything else is filtered out before it reaches
 * the database rather than after: Postgres rejects a malformed uuid with an
 * error, so an unvalidated `?ids=` would turn a typo into a 500.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The first value of a search param that may legitimately repeat. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminEventStatementsPrintPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale, "personal_data");

  const rawIds = (first(query.ids) ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, IDS_LIMIT);
  const ids = rawIds.filter((id) => UUID.test(id));
  const malformed = rawIds.length - ids.length;

  const langParam = first(query.lang);
  const lang = (locales as readonly string[]).includes(langParam ?? "")
    ? (langParam as DocLocale)
    : undefined;

  const result = await getStatementsForPrint(slug, ids, lang);
  if (!result) notFound();
  const { statements, unknownIds } = result;

  const listHref = `/admin/events/${slug}/statements`;
  const printable = statements.filter((s) => s.state === "statement").length;
  const missing = unknownIds.length + malformed;

  return (
    <>
      <div className="no-print">
        <Toolbar slug={slug} ids={ids} lang={lang} listHref={listHref} />

        {missing > 0 && (
          <div className="mt-3" data-statements-ignored={String(missing)}>
            <AdminNotice tone="warn">
              {missing} of the requested {missing === 1 ? "id was" : "ids were"} ignored: they name
              no registration for this event. A statement is only ever printed under the event it
              belongs to.
            </AdminNotice>
          </div>
        )}

        {statements.length === 0 && (
          <div className="mt-3" data-statements-empty="none">
            <AdminEmptyState title="Nothing to print">
              This link names no registration of this event. Pick a runner on the{" "}
              <Link
                href={listHref}
                className="text-admin-ink underline decoration-admin-line-2 underline-offset-2 hover:decoration-admin-accent"
              >
                statements list
              </Link>{" "}
              and open their statement from there.
            </AdminEmptyState>
          </div>
        )}
      </div>

      {statements.length > 0 && (
        <div className="print-area mt-4" data-statements-print={String(printable)}>
          {statements.map((statement, index) => (
            <div
              key={statement.registrationId}
              className={cn(index > 0 && "legal-page-break mt-10")}
            >
              <StatementSheet statement={statement} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Print, switch the language of the batch, go back. All of it `.no-print`. */
function Toolbar({
  slug,
  ids,
  lang,
  listHref,
}: {
  slug: string;
  ids: string[];
  lang: DocLocale | undefined;
  listHref: string;
}) {
  const withLang = (next: DocLocale | undefined) => {
    const search = new URLSearchParams();
    if (ids.length > 0) search.set("ids", ids.join(","));
    if (next) search.set("lang", next);
    const q = search.toString();
    return `/admin/events/${slug}/statements/print${q ? `?${q}` : ""}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={listHref} className={adminButton("quiet")}>
        ← Back to statements
      </Link>
      <PrintStatementsButton />
      <span className="ml-auto flex items-center gap-1.5 text-[12px] text-admin-muted">
        <span className="mr-1">Language</span>
        {/* "As recorded" is not a fourth language: it is the absence of an
            override, and the only option that prints the operative text for
            every runner in the batch. */}
        <LangLink href={withLang(undefined)} active={lang === undefined} label="As recorded" />
        {(["pl", "en", "ua"] as const).map((value) => (
          <LangLink
            key={value}
            href={withLang(value)}
            active={lang === value}
            label={value.toUpperCase()}
          />
        ))}
      </span>
    </div>
  );
}

function LangLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      data-print-lang={label}
      data-active={active ? "true" : "false"}
      className={cn(
        "rounded-admin px-2 py-0.5 hover:bg-admin-surface-2 hover:text-admin-ink",
        active && "bg-admin-surface-2 text-admin-ink",
      )}
    >
      {label}
    </Link>
  );
}

/**
 * One runner's sheet: the filled Statement, or the honest statement that there
 * is nothing to show. The "no consent" case stays *inside* `.print-area` on
 * purpose — a batch printed for a race night should account for every runner
 * asked for, including the ones whose registration predates the consent tables
 * (user story 26).
 */
function StatementSheet({ statement }: { statement: PrintedStatement }) {
  if (statement.state === "noConsent") {
    return (
      // No `.ace-landing` wrapper: the admin root already carries that class
      // (`admin/layout.tsx` renders `.ace-landing .iv .admin-root`), so the
      // scoped `legal.css` rules apply here as they do on the public preview.
      <div data-statement-state="no-consent">
        <p className="legal-notice">
          <strong>No consent on record</strong> — {statement.runnerName} registered before consent
          was captured, so there is no statement to print. Nothing is reconstructed from their
          profile: a document assembled from live data would look like evidence and would not be
          any.
        </p>
      </div>
    );
  }

  return (
    <div data-statement-state="statement">
      <div className="legal-card">
        <p className="no-print mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-admin-muted">
          {statement.runnerName} · {statement.docSlug} {statement.docVersion} ·{" "}
          {statement.lang.toUpperCase()}
          {statement.lang !== statement.submissionLocale
            ? ` · translation of the ${statement.submissionLocale.toUpperCase()} text accepted`
            : " · as accepted"}{" "}
          · {statement.acceptedAtLabel}
        </p>
        <div className="legal-scroll">
          {/* Trusted repository content (pandoc output, hashed in the manifest
              and guarded by the build) with the consent record substituted into
              it. Every value from the snapshot and the record is escaped in
              `renderStatementHtml` before it gets here. */}
          <div
            className="legal-prose"
            lang={statement.lang === "ua" ? "uk" : statement.lang}
            dangerouslySetInnerHTML={{ __html: statement.html }}
          />
        </div>
      </div>
    </div>
  );
}
