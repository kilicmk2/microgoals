import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { goals } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";
import { MASTER_EMAIL, EXECUTIVE_EMAILS } from "@/app/lib/store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? "";
    const isMaster = email === MASTER_EMAIL;
    const isExec = EXECUTIVE_EMAILS.includes(email);
    const { id } = await params;

    // Check permission: fetch the goal first
    const [existing] = await getDb().select().from(goals).where(eq(goals.id, id));
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.category === "executive" && !isExec) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.category === "personal" && existing.userId !== email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const isAdmin = isMaster || isExec;

    // Regular employees can update limited fields on company goals
    // (status, parentId, estimatedHours, owner — for assignments & connections)
    // Admins can update everything
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (existing.category === "company" && !isAdmin) {
      // Limited fields for regular employees
      if (body.status !== undefined) updates.status = body.status;
      if (body.parentId !== undefined) updates.parentId = body.parentId;
      if (body.estimatedHours !== undefined) updates.estimatedHours = body.estimatedHours;
      if (body.owner !== undefined) updates.owner = body.owner;
      if (body.order !== undefined) updates.order = body.order;
    } else {
      // Full access for admins and own personal goals
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
      if (body.parentId !== undefined) updates.parentId = body.parentId;
      if (body.estimatedHours !== undefined) updates.estimatedHours = body.estimatedHours;
    }

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

    const email = session.user.email ?? "";
    const isMaster = email === MASTER_EMAIL;
    const isExec = EXECUTIVE_EMAILS.includes(email);
    const { id } = await params;

    // Check permission
    const [existing] = await getDb().select().from(goals).where(eq(goals.id, id));
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.category === "executive" && !isExec) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.category === "company" && !isMaster && !isExec) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.category === "personal" && existing.userId !== email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await getDb().delete(goals).where(eq(goals.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
