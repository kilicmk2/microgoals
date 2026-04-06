import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { canvasNodes } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";
import { TECHNICAL_ADMINS } from "@/app/lib/store";

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
    const { id } = await params;
    const body = await req.json();

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
      lastEditedBy: email,
    };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.owner !== undefined) updates.owner = body.owner;
    if (body.estimatedHours !== undefined) updates.estimatedHours = body.estimatedHours;
    if (body.x !== undefined) updates.x = body.x;
    if (body.y !== undefined) updates.y = body.y;
    if (body.connectedTo !== undefined) updates.connectedTo = JSON.stringify(body.connectedTo);

    const [updated] = await getDb()
      .update(canvasNodes)
      .set(updates)
      .where(eq(canvasNodes.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      connectedTo: JSON.parse((updated.connectedTo as string) || "[]"),
    });
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
    if (!TECHNICAL_ADMINS.includes(email)) {
      return NextResponse.json({ error: "Only technical admins can delete" }, { status: 403 });
    }

    const { id } = await params;
    await getDb().delete(canvasNodes).where(eq(canvasNodes.id, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
