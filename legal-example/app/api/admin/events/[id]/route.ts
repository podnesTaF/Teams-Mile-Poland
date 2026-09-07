import { NextResponse } from "next/server";
import { deleteCustomEvent } from "@/lib/events-store";

/**
 * DELETE /api/admin/events/:id
 * Usuwa wydarzenie dodane ręcznie przez administratora. Wbudowanych
 * (BUILT_IN_EVENTS z lib/events.ts) nie da się usunąć stąd — to zapobiega
 * przypadkowemu skasowaniu edycji z bazowej listy startowej.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const removed = deleteCustomEvent(params.id);
  if (!removed) {
    return NextResponse.json(
      { error: "not_found_or_not_custom" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
