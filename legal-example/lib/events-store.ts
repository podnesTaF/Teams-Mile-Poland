import fs from "node:fs";
import path from "node:path";
import type { EventRecord } from "./types";

/**
 * WYDARZENIA DODANE PRZEZ ADMINISTRATORA — WYŁĄCZNIE DO DEWELOPMENTU/TESTÓW
 * ---------------------------------------------------------------------------
 * Realizuje wymaganie: „daty w dalszej kolejności dodaje/ustala administrator
 * przez swój panel narzędziowy" — patrz /admin/events (panel) oraz
 * /api/admin/events (API), które zapisują tutaj nowe dni wydarzeń (np.
 * kolejne edycje serii TEAM MILE POLAND na przyszłe daty).
 *
 * Zapisuje do lokalnego pliku JSON (`.data/events.json`), tak samo jak
 * `lib/submissions-store.ts`. PRZED PRODUKCJĄ podmienić na prawdziwą bazę
 * danych — plik na dysku nie jest trwały na hostingach bezserwerowych.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "events.json");

function ensureStore(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, "[]", "utf-8");
  }
}

export function listCustomEvents(): EventRecord[] {
  ensureStore();
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addCustomEvent(event: EventRecord): void {
  ensureStore();
  const all = listCustomEvents();
  all.push(event);
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2), "utf-8");
}

export function deleteCustomEvent(id: string): boolean {
  ensureStore();
  const all = listCustomEvents();
  const next = all.filter((e) => e.id !== id);
  const removed = next.length !== all.length;
  if (removed) {
    fs.writeFileSync(FILE, JSON.stringify(next, null, 2), "utf-8");
  }
  return removed;
}
