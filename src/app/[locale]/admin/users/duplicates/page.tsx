import { setRequestLocale } from "next-intl/server";

import { requireAdmin } from "@/features/admin/action-helpers";
import { NoDatabaseNotice } from "@/features/admin/components/no-database-notice";
import { adminButton } from "@/features/admin/components/shell/admin-button";
import { ADMIN_NOTE, ADMIN_TITLE, adminCard } from "@/features/admin/components/shell/admin-card";
import { AdminEmptyState } from "@/features/admin/components/shell/admin-empty-state";
import { AdminNotice } from "@/features/admin/components/shell/admin-notice";
import { AdminPage } from "@/features/admin/components/shell/admin-page";
import { AdminPill, type AdminPillTone } from "@/features/admin/components/shell/admin-pill";
import { AdminStat } from "@/features/admin/components/shell/admin-stat";
import {
  listDuplicateGroups,
  type DuplicateGroup,
  type DuplicateSignal,
} from "@/features/admin/duplicates-data";
import { formatAdminDate } from "@/features/admin/format";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The duplicates report: accounts that probably belong to one person, grouped
 * with the signal that caught them (task 09).
 *
 * A page of its own rather than a section of `/admin/users`, so the list stays a
 * list — this read groups over the whole `users` table and the list is opened
 * dozens of times a day. The list only carries the count, as a link here.
 *
 * Read-only by design: there is no merge tool, and the panel says so. Resolving
 * a group is a judgement call about which account keeps the history, so it
 * happens on the user detail page the members link to.
 */

/** Cells, matching the imported-results table's type scale. */
const HEAD_CELL =
  "px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-admin-muted";
const CELL = "px-3 py-2 align-middle text-[13px] text-admin-ink-2";

/** How each signal is named and toned on a group's card. Admin is English-only. */
const SIGNALS: Record<DuplicateSignal, { label: string; tone: AdminPillTone; hint: string }> = {
  phone: {
    label: "phone",
    tone: "warn",
    hint: "Both accounts carry the same phone number, in canonical +48… form",
  },
  name_dob: {
    label: "name + date of birth",
    tone: "accent",
    hint: "Same name once casing, accents and word order are normalised, and the same date of birth",
  },
  email: {
    label: "email",
    tone: "ink",
    hint: "Same email ignoring case — cannot happen once the unique index on lower(email) is applied",
  },
};

export default async function AdminUserDuplicatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdmin(locale);

  return (
    <AdminPage
      title="Possible duplicates"
      eyebrow="Users"
      actions={
        <Link href="/admin/users" className={adminButton("stroke")}>
          All users
        </Link>
      }
    >
      {process.env.DATABASE_URL ? (
        <DuplicatesBody />
      ) : (
        <NoDatabaseNotice>look for duplicate accounts</NoDatabaseNotice>
      )}
    </AdminPage>
  );
}

async function DuplicatesBody() {
  // Deliberately unguarded: if the store cannot answer (e.g. `phone_e164` is
  // not there yet), this page should fail rather than render "no duplicates".
  const groups = await listDuplicateGroups();
  const accounts = groups.reduce((sum, group) => sum + group.members.length, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <AdminStat label="Groups" value={groups.length} />
        <AdminStat label="Accounts involved" value={accounts} />
        <AdminStat
          label="Accounts to resolve"
          value={Math.max(0, accounts - groups.length)}
          hint="One person should end up with one account"
        />
      </div>

      <AdminNotice tone="info" className="mt-4">
        Signals, not verdicts — two runners can share a household phone, and an account with
        neither a confirmed phone number nor a date of birth cannot be grouped at all, so this is
        a floor and not a total. There is no merge tool: open a member below and resolve it by
        hand, keeping the account with the history and deleting or re-registering the other.
      </AdminNotice>

      {groups.length === 0 ? (
        <div className="mt-4">
          <AdminEmptyState title="No duplicates found">
            No two accounts share a phone number, a name and date of birth, or an email. New
            sign-ups are checked every time this page is opened.
          </AdminEmptyState>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3" data-duplicate-groups={groups.length}>
          {groups.map((group) => (
            <DuplicateGroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </>
  );
}

function DuplicateGroupCard({ group }: { group: DuplicateGroup }) {
  return (
    <section className={adminCard("p-4 sm:p-5")} data-duplicate-group={group.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <h2 className={ADMIN_TITLE}>{group.members[0]?.name}</h2>
        <p className={ADMIN_NOTE}>
          {group.members.length} accounts · joined {formatAdminDate(group.members[0]?.createdAt ?? null)}{" "}
          first
        </p>
      </div>

      {/* Every signal that pulled this group together, with the value the
          accounts agreed on — the "why" the desk needs before deleting one. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {group.matches.map((match) => (
          <AdminPill
            key={`${match.signal}:${match.value}`}
            tone={SIGNALS[match.signal].tone}
            dot
            title={SIGNALS[match.signal].hint}
          >
            <span>{SIGNALS[match.signal].label}</span>
            <span className="normal-case tracking-normal text-admin-ink-2">{match.value}</span>
          </AdminPill>
        ))}
      </div>

      <div className="admin-scroll mt-3 overflow-x-auto rounded-admin-lg border border-admin-line">
        <table className="w-full border-collapse text-left">
          <thead className="border-b border-admin-line bg-admin-surface-2">
            <tr>
              <th scope="col" className={HEAD_CELL}>
                Account
              </th>
              <th scope="col" className={HEAD_CELL}>
                Phone
              </th>
              <th scope="col" className={HEAD_CELL}>
                Born
              </th>
              <th scope="col" className={HEAD_CELL}>
                Signed up
              </th>
              <th scope="col" className={HEAD_CELL}>
                Races run
              </th>
              <th scope="col" className={HEAD_CELL} />
            </tr>
          </thead>
          <tbody>
            {group.members.map((member) => (
              <tr key={member.id} className="border-b border-admin-line last:border-b-0">
                <td className={CELL}>
                  <Link
                    href={`/admin/users/${member.id}`}
                    className="font-medium text-admin-ink hover:underline"
                  >
                    {member.name}
                  </Link>
                  <span className="block text-[12px] text-admin-muted">
                    {member.email}
                    {member.emailVerified ? null : " · unverified"}
                  </span>
                </td>
                <td className={CELL}>
                  {member.phone ?? <span className="text-admin-muted">—</span>}
                  {/* The display phone is what was typed; the canonical form is
                      what matched, so show it when the two differ. */}
                  {member.phoneE164 && member.phoneE164 !== member.phone ? (
                    <span className="block font-mono text-[11px] text-admin-muted">
                      {member.phoneE164}
                    </span>
                  ) : null}
                </td>
                <td className={cn(CELL, "font-mono text-[12px]")}>
                  {member.dateOfBirth ?? <span className="font-sans text-admin-muted">—</span>}
                </td>
                <td className={CELL}>{formatAdminDate(member.createdAt)}</td>
                <td className={CELL}>{member.raceCount}</td>
                <td className={CELL}>
                  <Link href={`/admin/users/${member.id}`} className={adminButton("quiet")}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
