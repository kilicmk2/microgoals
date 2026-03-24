import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { goals } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";
import { MASTER_EMAIL } from "@/app/lib/store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.email !== MASTER_EMAIL) {
    return NextResponse.json({ error: "Only admin can approve goals" }, { status: 403 });
  }

  const { id, action } = await req.json();

  if (action === "approve") {
    await getDb()
      .update(goals)
      .set({ approved: true, proposedBy: null, updatedAt: new Date() })
      .where(eq(goals.id, id));
    return NextResponse.json({ ok: true });
  } else if (action === "reject") {
    await getDb().delete(goals).where(eq(goals.id, id));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
