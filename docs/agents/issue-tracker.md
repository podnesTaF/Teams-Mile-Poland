# Issue Tracker

The tracker is **GitHub Issues** on `podnesTaF/Teams-Mile-Poland`, driven through the `gh` CLI. There is no separate tool — a "PRD" and a "slice" are both GitHub issues, distinguished by labels.

## Commands

```bash
# create
gh issue create --title "..." --body-file <path> --label prd --label ready-for-agent --label area:events

# fetch (body + comments)
gh issue view <n> --comments

# comment
gh issue comment <n> --body-file <path>

# tick criteria / close
gh issue edit <n> --body-file <updated>      # to tick acceptance boxes
gh issue close <n>

# list ready work
gh issue list --label ready-for-agent --state open
```

Write bodies to a file (scratchpad) and pass `--body-file` — heredocs and inline `--body` mangle multi-line markdown on Windows PowerShell.

## Labels

Workflow labels:

- `prd` — a PRD issue (the parent). Not directly implementable.
- `ready-for-agent` — an implementable slice, or a PRD whose slices are ready.

Area labels (this is a single Next.js app, so "area" replaces LiftPeak's "surface"):

- `area:events` — event config registry (`src/lib/events`), event detail/series pages
- `area:auth` — Better Auth, sign-in/up/verify/reset flows
- `area:registration` — event registration flow, tickets
- `area:admin` — `/admin/*` roster, check-in, export
- `area:emails` — React Email templates, mailings/cron dispatch
- `area:db` — Drizzle schema + migrations
- `area:landing` — landing page, series overview, marketing surfaces
- `area:i18n` — message catalogs (pl/en/ua)

Create any missing label idempotently before publishing:

```bash
gh label create "area:events" --color 1f6feb --force
```

## Conventions

- A PRD issue carries `prd` + the area labels it touches. Slices carry `ready-for-agent` + their area labels and reference the PRD in their **Parent** section (`#<prd-number>`).
- Publish slices in dependency order so real issue numbers can fill the **Blocked by** field.
- Commits reference the issue with `#<n>`. On finishing a slice, comment the commit SHA(s), tick the met acceptance-criteria checkboxes in the body, and close only when all are ticked.
- Do not close or edit the parent PRD when finishing a child slice.
