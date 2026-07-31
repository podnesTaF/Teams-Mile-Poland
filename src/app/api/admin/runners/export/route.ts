import { NextResponse } from "next/server";

import {
  buildRunnersExportWorkbook,
  exportFilename,
  parseExportScope,
} from "@/features/admin/export-runners";
import { getAdminUser } from "@/lib/auth/user-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const scope = parseExportScope(new URL(request.url).searchParams.get("scope"));

  try {
    const buffer = await buildRunnersExportWorkbook(scope);
    const filename = exportFilename(scope);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
