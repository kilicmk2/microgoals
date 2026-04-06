import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { goals } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";
import { MASTER_EMAIL, EXECUTIVE_EMAILS } from "@/app/lib/store";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email ?? "";
    const isMaster = email === MASTER_EMAIL;
    const isExec = EXECUTIVE_EMAILS.includes(email);

    const body: { id: string; order: number; horizon?: string }[] = await req.json();

    // Fetch all goals being reordered to check permissions
    const goalIds = body.map((b) => b.id);
    const existingGoals = await Promise.all(
      goalIds.map((id) => getDb().select().from(goals).where(eq(goals.id, id)).then((r) => r[0]))
    );

    for (const g of existingGoals) {
      if (!g) continue;
      if (g.category === "executive" && !isExec) {
        return NextResponse.json({ error: "Forbidden: cannot reorder executive goals" }, { status: 403 });
      }
      if (g.category === "company" && !isMaster && !isExec) {
        return NextResponse.json({ error: "Forbidden: cannot reorder company goals" }, { status: 403 });
      }
      if (g.category === "personal" && g.userId !== email) {
        return NextResponse.json({ error: "Forbidden: cannot reorder others' personal goals" }, { status: 403 });
      }
    }

    await Promise.all(
      body.map(({ id, order, horizon }) =>
        getDb()
          .update(goals)
          .set({ order, ...(horizon ? { horizon } : {}), updatedAt: new Date() })
          .where(eq(goals.id, id))
      )
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
