import { NextResponse } from "next/server";
import { getEventById } from "@/lib/events";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const event = getEventById(params.id);
  if (!event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ event });
}
