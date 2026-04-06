import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { canvasStrokes } from "@/app/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { TECHNICAL_ADMINS } from "@/app/lib/store";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await getDb().select().from(canvasStrokes).orderBy(asc(canvasStrokes.createdAt));
    return NextResponse.json(result.map((s) => ({ ...s, points: JSON.parse(s.points) })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const [created] = await getDb()
      .insert(canvasStrokes)
      .values({
        points: JSON.stringify(body.points || []),
        color: body.color || "#000000",
        width: body.width || 2,
        createdBy: session.user.email ?? "",
      })
      .returning();
    return NextResponse.json({ ...created, points: JSON.parse(created.points) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!TECHNICAL_ADMINS.includes(session.user.email ?? "")) {
      return NextResponse.json({ error: "Only admins can clear strokes" }, { status: 403 });
    }
    const { id } = await req.json();
    if (id) {
      await getDb().delete(canvasStrokes).where(eq(canvasStrokes.id, id));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
