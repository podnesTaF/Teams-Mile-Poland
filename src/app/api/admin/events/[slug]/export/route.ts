import { NextResponse } from "next/server";

import { buildEventRosterWorkbook, rosterExportFilename } from "@/features/admin/events-data";
import { getEventBySlug } from "@/lib/events/registry";
import { getAdminSession } from "@/lib/auth/admin-session";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const event = getEventBySlug(slug);
  if (!event || event.eventType !== "individual") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const buffer = await buildEventRosterWorkbook(slug);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${rosterExportFilename(slug)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
