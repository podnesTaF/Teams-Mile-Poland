/* Preview-only context, merged into the bundle via cfg.extraEntries.
 *
 * PhoneField calls next-intl's useTranslations("common.phone"), which throws
 * outside a NextIntlClientProvider — in the app that provider comes from
 * src/app/[locale]/layout.tsx, which no design ever renders. Without this the
 * card is an empty root ([RENDER]) and the component ships unusable.
 *
 * cfg.provider wires these two exports as the wrapper for every card.
 *
 * `common` is imported as a *named* export of the real messages file rather
 * than copied: the strings stay sourced from src/messages/en.json (a copy here
 * would silently rot), and the named form lets esbuild drop the other 20-odd
 * namespaces instead of inlining all 97 KB of it.
 *
 * Only `common` is exported because that is the only namespace the
 * src/components/ui primitives read. A component added under a new namespace
 * needs it added here too — otherwise its card renders empty.
 */
import { common } from "../../src/messages/en.json";

export { NextIntlClientProvider } from "next-intl";

export const previewMessages = { common };
