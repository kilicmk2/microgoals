import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { goals } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.horizon !== undefined) updates.horizon = body.horizon;
    if (body.owner !== undefined) updates.owner = body.owner;
    if (body.reasoning !== undefined) updates.reasoning = body.reasoning;
    if (body.pinned !== undefined) updates.pinned = body.pinned;
    if (body.order !== undefined) updates.order = body.order;
    if (body.workstream !== undefined) updates.workstream = body.workstream;
    if (body.targetDate !== undefined) updates.targetDate = body.targetDate;

    const [updated] = await getDb()
      .update(goals)
      .set(updates)
      .where(eq(goals.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await getDb().delete(goals).where(eq(goals.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
