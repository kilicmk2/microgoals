import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { notifications } from "@/app/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getDb()
      .select()
      .from(notifications)
      .where(eq(notifications.userId, session.user.email))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const [created] = await getDb()
      .insert(notifications)
      .values({
        userId: body.userId,
        type: body.type || "task_assigned",
        title: body.title,
        sourceId: body.sourceId || null,
        sourcePage: body.sourcePage || "technical",
        fromUser: session.user.email,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json();
    if (id === "all") {
      await getDb()
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, session.user.email));
    } else {
      await getDb()
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, session.user.email)));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
