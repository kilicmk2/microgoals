import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { canvasNodes } from "@/app/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getDb()
      .select()
      .from(canvasNodes)
      .orderBy(asc(canvasNodes.createdAt));

    // Parse connectedTo from JSON string to array
    const parsed = result.map((n) => ({
      ...n,
      connectedTo: JSON.parse((n.connectedTo as string) || "[]"),
    }));

    return NextResponse.json(parsed);
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

    const email = session.user.email ?? "";
    const body = await req.json();

    const [created] = await getDb()
      .insert(canvasNodes)
      .values({
        userId: email,
        title: body.title || "New task",
        description: body.description || "",
        status: body.status || "not_started",
        owner: body.owner || "",
        estimatedHours: body.estimatedHours || null,
        x: body.x ?? 200,
        y: body.y ?? 200,
        connectedTo: JSON.stringify(body.connectedTo || []),
        createdBy: email,
        lastEditedBy: email,
      })
      .returning();

    return NextResponse.json({
      ...created,
      connectedTo: JSON.parse((created.connectedTo as string) || "[]"),
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
