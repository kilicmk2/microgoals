import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { goals } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: { id: string; order: number; horizon?: string }[] = await req.json();

  await Promise.all(
    body.map(({ id, order, horizon }) =>
      getDb()
        .update(goals)
        .set({ order, ...(horizon ? { horizon } : {}), updatedAt: new Date() })
        .where(eq(goals.id, id))
    )
  );

  return NextResponse.json({ ok: true });
}
