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
 * The query is the whole selection API, which is what let #55 add roster and
 * list selection without changing how anything here works: it already took a
 * list. What #55 did add is the toolbar's batch header — a stack of forty sheets
 * cannot be checked by looking at it, so the count, the number of "no consent"
 * sheets in it and the language rule in force are stated before the press.
 *
 * `lang` is optional and applies to the batch. Omitted, each Statement renders
 * in the locale its own submission recorded — a mixed-language field prints as a
 * mixed-language batch, which is correct: the recorded language is the operative
 * text and a convenience translation is not.
 */

/**
 * How many ids one press may carry. A race night is a few dozen entries, so this
 * is a bound on a crafted or pasted URL rather than on any real batch — but the
 * read it guards fills a legal document per id, so it is a hard cap and not a
 * hint. `PRINT_IDS_LIMIT` in `statement-print-bar.tsx` mirrors it, so a
 * selection over the cap is *said* before it is pressed instead of being
 * silently truncated here.
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
  const noConsent = statements.length - printable;
  const missing = unknownIds.length + malformed;
  /** Nothing was asked for at all, as opposed to nothing being found. */
  const askedForNothing = rawIds.length === 0;

  return (
    <>
      <div className="no-print">
        <Toolbar slug={slug} ids={ids} lang={lang} listHref={listHref} />

        {statements.length > 0 && (
          <BatchHeader
            statements={statements}
            printable={printable}
            noConsent={noConsent}
            lang={lang}
          />
        )}

        {missing > 0 && (
          <div className="mt-3" data-statements-ignored={String(missing)}>
            <AdminNotice tone="warn">
              {missing} of the requested {missing === 1 ? "id was" : "ids were"} ignored: they name
              no registration for this event. A statement is only ever printed under the event it
              belongs to.
            </AdminNotice>
          </div>
        )}

        {/* Two different nothings, said differently: an empty `?ids=` is a
            print pressed with no selection — an ordinary slip, and the fix is
            to go and tick someone. Ids that matched nothing is a stale or
            copied link, which is a different problem and gets the warning
            above as well. */}
        {statements.length === 0 && (
          <div className="mt-3" data-statements-empty={askedForNothing ? "no-selection" : "none"}>
            <AdminEmptyState
              title={askedForNothing ? "Nothing selected to print" : "Nothing to print"}
            >
              {askedForNothing ? (
                <>
                  No registrations were selected, so there is nothing to assemble. Tick the runners
                  you need on the{" "}
                  <Link
                    href={listHref}
                    className="text-admin-ink underline decoration-admin-line-2 underline-offset-2 hover:decoration-admin-accent"
                  >
                    statements list
                  </Link>{" "}
                  — or on the event roster — and press Print selected.
                </>
              ) : (
                <>
                  This link names no registration of this event. Pick a runner on the{" "}
                  <Link
                    href={listHref}
                    className="text-admin-ink underline decoration-admin-line-2 underline-offset-2 hover:decoration-admin-accent"
                  >
                    statements list
                  </Link>{" "}
                  and open their statement from there.
                </>
              )}
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

/**
 * What is about to come out of the printer, before it does (#55).
 *
 * A batch is the case where the admin cannot check the output by looking at it:
 * forty sheets, some in Polish, some in Ukrainian, one of them a "no consent"
 * notice. So the toolbar states the three facts that decide whether the stack is
 * the right stack — how many sheets, how many of those are the absence of a
 * document rather than one, and which language rule is in force — and it states
 * them in `.no-print`, so none of it reaches the paper.
 *
 * "As recorded" names the languages actually in the batch rather than just
 * saying "mixed": a mixed batch is the correct default, and an admin who can see
 * it is PL + UK does not have to wonder whether something went wrong.
 */
function BatchHeader({
  statements,
  printable,
  noConsent,
  lang,
}: {
  statements: PrintedStatement[];
  printable: number;
  noConsent: number;
  lang: DocLocale | undefined;
}) {
  const langs = [
    ...new Set(
      statements.flatMap((s) => (s.state === "statement" ? [DOC_LANG_LABEL[s.lang]] : [])),
    ),
  ];
  const mode = lang
    ? `forced to ${lang.toUpperCase()}`
    : langs.length === 0
      ? "as recorded"
      : `as recorded (${langs.join(" + ")})`;

  return (
    <p
      data-statements-batch={statements.length}
      data-statements-batch-printable={printable}
      data-statements-batch-noconsent={noConsent}
      data-print-lang-mode={lang ?? "recorded"}
      className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-admin-muted"
    >
      {statements.length} {statements.length === 1 ? "sheet" : "sheets"}
      {" · "}
      {printable} {printable === 1 ? "statement" : "statements"}
      {noConsent > 0 ? ` · ${noConsent} without consent on record` : ""}
      {" · "}
      Language {mode}
    </p>
  );
}

/** The document language, as the toolbar names it — `ua` prints as UK, its tag. */
const DOC_LANG_LABEL: Record<DocLocale, string> = { pl: "PL", en: "EN", ua: "UK" };

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
