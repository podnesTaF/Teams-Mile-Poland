import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /**
   * The legal document routes read their HTML off disk with `node:fs`
   * (`src/lib/legal/content.ts`), so file tracing cannot see the dependency and
   * would ship a lambda with no corpus in it. The pages are prerendered at build
   * time, but `dynamicParams` stays at its default on both — an event created
   * after the last deploy, or a document newly flagged `eventless`, renders on
   * first request — and that request needs the files.
   *
   * The build guard itself is not here: it is the first half of the `build` npm
   * script (`scripts/check-legal-manifest.ts`), where a failure prints its own
   * message instead of arriving wrapped in a Next.js config-load error.
   */
  outputFileTracingIncludes: {
    "/[locale]/events/[slug]/legal/[doc]": ["src/content/legal/**/*.html"],
    "/[locale]/legal/[doc]": ["src/content/legal/**/*.html"],
  },
};

export default withNextIntl(nextConfig);
