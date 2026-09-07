import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/lib/types";

// Zapasowy redirect (oprócz next.config.mjs -> redirects()), gdyby ta
// konfiguracja została kiedyś usunięta przy integracji z resztą serwisu.
export default function RootPage() {
  redirect(`/${DEFAULT_LOCALE}`);
}
