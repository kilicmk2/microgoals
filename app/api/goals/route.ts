import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { goals } from "@/app/lib/db/schema";
import { eq, and, or, asc } from "drizzle-orm";
import { MASTER_EMAIL } from "@/app/lib/store";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.email || session.user.id || "";
    const category = req.nextUrl.searchParams.get("category") || "company";
    const isMaster = session.user.email === MASTER_EMAIL;

    const conditions = [];

    if (category === "company") {
      conditions.push(eq(goals.category, "company"));
      if (!isMaster) {
        conditions.push(
          or(
            eq(goals.approved, true),
            eq(goals.proposedBy, session.user.email ?? "")
          )!
        );
      }
    } else {
      conditions.push(eq(goals.category, "personal"));
      conditions.push(eq(goals.userId, userId));
    }

    const result = await getDb()
      .select()
      .from(goals)
      .where(and(...conditions))
      .orderBy(asc(goals.order));

    return NextResponse.json(result);
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

    const userId = session.user.email || session.user.id || "";
    const body = await req.json();
    const isMaster = session.user.email === MASTER_EMAIL;
    const needsApproval = body.category === "company" && !isMaster;

    const [created] = await getDb()
      .insert(goals)
      .values({
        userId: body.category === "personal" ? userId : null,
        title: body.title,
        description: body.description || "",
        status: body.status || "not_started",
        horizon: body.horizon,
        category: body.category,
        owner: body.owner || "",
        parentId: body.parentId || null,
        reasoning: body.reasoning || "",
        pinned: body.pinned || false,
        order: body.order ? Math.min(body.order, 2000000000) : Math.floor(Date.now() / 1000) % 2000000000,
        approved: !needsApproval,
        proposedBy: needsApproval ? (session.user.email ?? "") : null,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
