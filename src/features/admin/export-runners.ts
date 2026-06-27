import ExcelJS from "exceljs";
import { desc, eq } from "drizzle-orm";

import { runners, teams } from "@/db/schema";
import { getDb } from "@/lib/db";

export type RunnerExportRow = {
  fullName: string;
  email: string;
  phone: string;
  registrationType: string;
  assignmentStatus: string;
  paymentStatus: string;
  teamName: string | null;
  teamCode: string | null;
  locale: string;
  freeSlot: boolean;
  checkedInAt: Date | null;
  createdAt: Date;
};

export type TeamExportRow = {
  name: string;
  code: string;
  size: number | null;
  status: string;
  runnerCount: number;
  createdAt: Date;
};

export type ExportScope = "all" | "runners" | "teams";

export async function listRunnersForExport(): Promise<RunnerExportRow[]> {
  return getDb()
    .select({
      fullName: runners.fullName,
      email: runners.email,
      phone: runners.phone,
      registrationType: runners.registrationType,
      assignmentStatus: runners.assignmentStatus,
      paymentStatus: runners.paymentStatus,
      teamName: teams.name,
      teamCode: teams.code,
      locale: runners.locale,
      freeSlot: runners.freeSlot,
      checkedInAt: runners.checkedInAt,
      createdAt: runners.createdAt,
    })
    .from(runners)
    .leftJoin(teams, eq(runners.teamId, teams.id))
    .orderBy(desc(runners.createdAt));
}

export async function listTeamsForExport(): Promise<TeamExportRow[]> {
  const db = getDb();
  const teamRows = await db.select().from(teams).orderBy(desc(teams.createdAt));
  const runnerRows = await db.select({ teamId: runners.teamId }).from(runners);

  const countsByTeam = new Map<string, number>();
  for (const r of runnerRows) {
    if (r.teamId) countsByTeam.set(r.teamId, (countsByTeam.get(r.teamId) ?? 0) + 1);
  }

  return teamRows.map((t) => ({
    name: t.name,
    code: t.code,
    size: t.size,
    status: t.status,
    runnerCount: countsByTeam.get(t.id) ?? 0,
    createdAt: t.createdAt,
  }));
}

function fmtDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function addRunnersSheet(workbook: ExcelJS.Workbook, rows: RunnerExportRow[]) {
  const sheet = workbook.addWorksheet("Runners");
  sheet.columns = [
    { header: "Full name", key: "fullName", width: 28 },
    { header: "Email", key: "email", width: 32 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Registration type", key: "registrationType", width: 18 },
    { header: "Assignment status", key: "assignmentStatus", width: 18 },
    { header: "Payment status", key: "paymentStatus", width: 14 },
    { header: "Team name", key: "teamName", width: 24 },
    { header: "Team code", key: "teamCode", width: 12 },
    { header: "Locale", key: "locale", width: 8 },
    { header: "Free slot", key: "freeSlot", width: 10 },
    { header: "Checked in", key: "checkedInAt", width: 20 },
    { header: "Registered", key: "createdAt", width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow({
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      registrationType: row.registrationType.replaceAll("_", " "),
      assignmentStatus: row.assignmentStatus.replaceAll("_", " "),
      paymentStatus: row.paymentStatus,
      teamName: row.teamName ?? "",
      teamCode: row.teamCode ?? "",
      locale: row.locale,
      freeSlot: yesNo(row.freeSlot),
      checkedInAt: fmtDate(row.checkedInAt),
      createdAt: fmtDate(row.createdAt),
    });
  }
}

function addTeamsSheet(workbook: ExcelJS.Workbook, rows: TeamExportRow[]) {
  const sheet = workbook.addWorksheet("Teams");
  sheet.columns = [
    { header: "Team name", key: "name", width: 28 },
    { header: "Code", key: "code", width: 12 },
    { header: "Declared size", key: "size", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Runners", key: "runnerCount", width: 10 },
    { header: "Created", key: "createdAt", width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow({
      name: row.name,
      code: row.code,
      size: row.size ?? "",
      status: row.status,
      runnerCount: row.runnerCount,
      createdAt: fmtDate(row.createdAt),
    });
  }
}

export async function buildRunnersExportWorkbook(scope: ExportScope): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Teams Mile Admin";
  workbook.created = new Date();

  if (scope === "all" || scope === "runners") {
    addRunnersSheet(workbook, await listRunnersForExport());
  }
  if (scope === "all" || scope === "teams") {
    addTeamsSheet(workbook, await listTeamsForExport());
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function exportFilename(scope: ExportScope): string {
  const date = new Date().toISOString().slice(0, 10);
  if (scope === "runners") return `runners-${date}.xlsx`;
  if (scope === "teams") return `teams-${date}.xlsx`;
  return `registrations-${date}.xlsx`;
}

export function parseExportScope(value: string | null): ExportScope {
  if (value === "runners" || value === "teams") return value;
  return "all";
}
