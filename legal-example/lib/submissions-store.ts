import fs from "node:fs";
import path from "node:path";

/**
 * MAGAZYN ZGŁOSZEŃ — WYŁĄCZNIE DO DEWELOPMENTU/TESTÓW
 * -----------------------------------------------------
 * Zapisuje przesłane formularze do lokalnego pliku JSON
 * (`.data/submissions.json`), żeby panel administratora (/admin) miał co
 * wyświetlić podczas testowania na `npm run dev` / `npm start`.
 *
 * ZANIM POJEDZIECIE NA PRODUKCJĘ: podmieńcie funkcje w tym pliku na
 * zapytania do prawdziwej bazy danych (Postgres/Supabase/Prisma itp.).
 * Zapis do pliku na dysku NIE DZIAŁA NIEZAWODNIE na hostingach
 * bezserwerowych (np. Vercel) — system plików tam jest efemeryczny i
 * może zostać wyczyszczony między requestami/wdrożeniami. To świadomy,
 * tymczasowy wybór, żeby dać Wam od razu działającą, testowalną wersję.
 */

export interface StoredSubmission {
  id: string;
  receivedAt: string;
  ip: string | null;
  userAgent: string | null;
  eventId: string;
  locale: string;
  docSlug: string;
  fields: Record<string, string>;
  checkboxes: Record<string, boolean>;
  imageConsent?: "agree" | "disagree";
}

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "submissions.json");

function ensureStore(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, "[]", "utf-8");
  }
}

export function appendSubmission(record: StoredSubmission): void {
  ensureStore();
  const all = readAllSubmissions();
  all.push(record);
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2), "utf-8");
}

export function readAllSubmissions(): StoredSubmission[] {
  ensureStore();
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSubmissionById(id: string): StoredSubmission | undefined {
  return readAllSubmissions().find((s) => s.id === id);
}

/** Najnowsze zgłoszenia najpierw — do tabeli w panelu administratora. */
export function listSubmissionsSorted(): StoredSubmission[] {
  return [...readAllSubmissions()].sort((a, b) =>
    b.receivedAt.localeCompare(a.receivedAt),
  );
}
