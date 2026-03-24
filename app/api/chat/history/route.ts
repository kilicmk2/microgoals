import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { chatMessages } from "@/app/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json([], { status: 200 });
    }

    const userId = session.user.email || session.user.id || "";
    const messages = await getDb()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(asc(chatMessages.timestamp));

    return NextResponse.json(messages);
  } catch (e) {
    return NextResponse.json([], { status: 200 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.email || session.user.id || "";
    await getDb().delete(chatMessages).where(eq(chatMessages.userId, userId));

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
