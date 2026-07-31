/* Design-system entry point.
 *
 * This barrel exists so the converter has a single real entry to bundle
 * and to emit type declarations from. It re-exports the app's own
 * src/components/ui primitives unchanged — no wrappers, no copies.
 *
 * language-switcher is deliberately absent: it reads next-intl's locale
 * context and the Next router, neither of which exists outside the app,
 * so it cannot render in a design. It is excluded in config.json too
 * (componentSrcMap.LanguageSwitcher = null).
 */
export * from "../../src/components/ui/button";
export * from "../../src/components/ui/cbx";
export * from "../../src/components/ui/chip";
export * from "../../src/components/ui/container";
export * from "../../src/components/ui/eyebrow";
export * from "../../src/components/ui/float-field";
export * from "../../src/components/ui/icons";
export * from "../../src/components/ui/loader";
export * from "../../src/components/ui/loading-screen";
export * from "../../src/components/ui/modal";
export * from "../../src/components/ui/phone-field";
export * from "../../src/components/ui/rank";
export * from "../../src/components/ui/section";
export * from "../../src/components/ui/wordmark";
