/**
 * PROSTA, TYMCZASOWA OCHRONA PANELU ADMINISTRATORA
 * --------------------------------------------------
 * Cały panel /admin jest chroniony jednym współdzielonym kodem dostępu
 * (zmienna środowiskowa ADMIN_ACCESS_CODE). To celowo minimalne
 * rozwiązanie — wystarczające, żeby dane uczestników nie były dostępne
 * pod publicznym adresem podczas testów, ale NIE zastępuje prawdziwego
 * uwierzytelniania z kontami i rolami.
 *
 * PRZED PRODUKCJĄ ZALECAMY: NextAuth.js (lub podobne) z osobnymi kontami
 * dla każdego administratora/menedżera, najlepiej z SSO firmowym.
 *
 * Plik jest importowany zarówno przez middleware.ts (uruchamiany w Edge
 * Runtime) jak i przez zwykłe API routes (Node runtime) — dlatego celowo
 * nie używa żadnego modułu specyficznego dla Node (np. `node:crypto`).
 */

export const ADMIN_SESSION_COOKIE = "acebattle_admin_session";

/**
 * Sprawdza, czy wartość ciasteczka sesji odpowiada skonfigurowanemu
 * kodowi dostępu. Jeśli ADMIN_ACCESS_CODE nie jest ustawiony w env —
 * panel jest domyślnie ZABLOKOWANY (bezpieczne wyjście awaryjne, żeby
 * nikt nie zapomniał ustawić kodu przed wdrożeniem).
 */
export function isValidAdminSessionValue(value: string | null): boolean {
  const expected = process.env.ADMIN_ACCESS_CODE;
  if (!expected) return false;
  if (!value) return false;
  return value === expected;
}
