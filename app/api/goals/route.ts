import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { goals } from "@/app/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = req.nextUrl.searchParams.get("category") || "company";
  const horizon = req.nextUrl.searchParams.get("horizon");

  const conditions = [];

  if (category === "company") {
    conditions.push(eq(goals.category, "company"));
  } else {
    conditions.push(eq(goals.category, "personal"));
    conditions.push(eq(goals.userId, session.user.id));
  }

  if (horizon) {
    conditions.push(eq(goals.horizon, horizon));
  }

  const result = await getDb()
    .select()
    .from(goals)
    .where(and(...conditions))
    .orderBy(asc(goals.order));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const [created] = await getDb()
    .insert(goals)
    .values({
      userId: body.category === "personal" ? session.user.id : null,
      title: body.title,
      description: body.description || "",
      status: body.status || "not_started",
      horizon: body.horizon,
      category: body.category,
      owner: body.owner || "",
      parentId: body.parentId || null,
      reasoning: body.reasoning || "",
      pinned: body.pinned || false,
      order: body.order ?? Date.now(),
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
