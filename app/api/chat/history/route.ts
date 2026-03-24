import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { chatMessages } from "@/app/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const messages = await getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, session.user.id))
    .orderBy(asc(chatMessages.timestamp));

  return NextResponse.json(messages);
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await getDb().delete(chatMessages).where(eq(chatMessages.userId, session.user.id));

  return NextResponse.json({ ok: true });
}
