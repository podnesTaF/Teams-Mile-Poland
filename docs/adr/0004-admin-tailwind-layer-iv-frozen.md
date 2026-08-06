# Admin UI migrates to a Tailwind component layer; `.iv-*` is frozen for admin

The admin panel was styled entirely by `.iv-*` classes in `landing.css` under the dark
`.ace-landing` root — hand-written CSS, heavy inline styles, no Tailwind. For the 2026
admin redesign we decided new admin chrome and redesigned pages (shell/sidebar, dashboard,
event pages) are built as small reusable components styled with Tailwind + `cn()` on a
dark admin token set, while the `.ace-landing`/`.iv-*` root stays in place so
not-yet-redesigned pages (Users, Admins, Inquiries, News, Legacy, Mailings) render
unchanged inside the new shell.

Two styling idioms therefore coexist under `/admin` **deliberately** during the
migration. Do not "fix" this by porting new components back to `.iv-*`, and do not grow
the `.iv-*` vocabulary for admin — new admin UI uses the Tailwind layer; `.iv-*` usage
shrinks as pages are migrated. The alternative (extending `.iv-*` for the redesign) was
rejected to stop the 4,600-line stylesheet growing further; a light-theme rebuild was
rejected because `.iv-*` content is built from white-alpha values that require the dark
root, which would have forced restyling all 13 pages at once.
