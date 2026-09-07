import { NextResponse, type NextRequest } from "next/server";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/types";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionValue } from "@/lib/admin-auth";

/**
 * Wykrywanie języka przeglądarki
 * --------------------------------
 * Działa tylko dla ścieżki startowej "/" (bez segmentu językowego).
 * Jeśli użytkownik wejdzie od razu na konkretny URL z językiem
 * (np. /en/documents/oswiadczenie), middleware NIC nie zmienia —
 * wybór z linku / zakładki zawsze wygrywa nad nagłówkiem przeglądarki.
 *
 * Dopasowanie Accept-Language -> nasze locale:
 *   pl -> pl
 *   uk, ua -> ua (ukraiński)
 *   ru, be -> ru (rosyjski jako najbliższy dla części odbiorców CIS)
 *   wszystko inne -> en
 */
function pickLocaleFromHeader(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const preferred = header
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter(Boolean) as string[];

  for (const lang of preferred) {
    if (lang.startsWith("pl")) return "pl";
    if (lang.startsWith("uk") || lang === "ua") return "ua";
    if (lang.startsWith("ru") || lang.startsWith("be")) return "ru";
    if (lang.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

function handlePublicLocaleRouting(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const firstSegment = pathname.split("/")[1];
  const hasLocale = (LOCALES as string[]).includes(firstSegment ?? "");

  if (hasLocale) {
    return NextResponse.next();
  }

  const cookieLocale = req.cookies.get("NEXT_LOCALE")?.value;
  const locale =
    cookieLocale && (LOCALES as string[]).includes(cookieLocale)
      ? (cookieLocale as Locale)
      : pickLocaleFromHeader(req.headers.get("accept-language"));

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

/**
 * Ochrona panelu administratora (/admin/*)
 * -----------------------------------------
 * Prosta, jawnie oznaczona jako TYMCZASOWA bramka dostępu oparta na
 * współdzielonym kodzie (ADMIN_ACCESS_CODE w .env) — wystarczająca do
 * testów i małego zespołu, ale PRZED PRODUKCJĄ zalecamy prawdziwe
 * uwierzytelnianie (np. NextAuth + lista kont z rolami "admin"/"manager").
 * Szczegóły w README.md.
 */
function handleAdminAccess(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Strona logowania i jej API muszą być zawsze dostępne (inaczej nikt
  // nigdy by się nie zalogował).
  if (pathname === "/admin/login" || pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null;
  if (isValidAdminSessionValue(cookie)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Panel administratora żyje CAŁKOWICIE poza publiczną strukturą
  // językową /{lang}/... — nie ma tu wykrywania języka, tylko kontrola
  // dostępu.
  if (pathname.startsWith("/admin")) {
    return handleAdminAccess(req);
  }

  // Pomijamy pliki statyczne, API i ścieżki z już poprawnym locale.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  return handlePublicLocaleRouting(req);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
