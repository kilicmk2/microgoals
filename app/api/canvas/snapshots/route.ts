import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { canvasNodes, canvasStrokes, canvasSnapshots } from "@/app/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { TECHNICAL_ADMINS } from "@/app/lib/store";

// GET: list snapshots (most recent first, max 50)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getDb()
      .select({ id: canvasSnapshots.id, label: canvasSnapshots.label, createdBy: canvasSnapshots.createdBy, createdAt: canvasSnapshots.createdAt })
      .from(canvasSnapshots)
      .orderBy(desc(canvasSnapshots.createdAt))
      .limit(50);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: create a snapshot of current canvas state
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const label = body.label || "auto";
    const db = getDb();

    // Get current state
    const nodes = await db.select().from(canvasNodes).orderBy(asc(canvasNodes.createdAt));
    const strokes = await db.select().from(canvasStrokes).orderBy(asc(canvasStrokes.createdAt));

    // Save snapshot
    const [snap] = await db.insert(canvasSnapshots).values({
      label,
      nodesJson: JSON.stringify(nodes),
      strokesJson: JSON.stringify(strokes),
      createdBy: session.user.email ?? "",
    }).returning();

    // Prune old snapshots — keep max 500
    const all = await db.select({ id: canvasSnapshots.id }).from(canvasSnapshots).orderBy(desc(canvasSnapshots.createdAt));
    if (all.length > 500) {
      const toDelete = all.slice(500);
      for (const old of toDelete) {
        await db.delete(canvasSnapshots).where(eq(canvasSnapshots.id, old.id));
      }
    }

    return NextResponse.json({ id: snap.id, label: snap.label }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH: restore a snapshot (replaces current canvas with snapshot data)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!TECHNICAL_ADMINS.includes(session.user.email ?? "")) {
      return NextResponse.json({ error: "Only admins can restore snapshots" }, { status: 403 });
    }

    const { snapshotId } = await req.json();
    const db = getDb();

    // Get the snapshot
    const [snap] = await db.select().from(canvasSnapshots).where(eq(canvasSnapshots.id, snapshotId));
    if (!snap) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });

    const savedNodes = JSON.parse(snap.nodesJson);
    const savedStrokes = JSON.parse(snap.strokesJson);

    // Save current state as a snapshot first (so we can undo the restore)
    const currentNodes = await db.select().from(canvasNodes);
    const currentStrokes = await db.select().from(canvasStrokes);
    await db.insert(canvasSnapshots).values({
      label: "pre-restore",
      nodesJson: JSON.stringify(currentNodes),
      strokesJson: JSON.stringify(currentStrokes),
      createdBy: session.user.email ?? "",
    });

    // Clear current canvas
    const existingNodes = await db.select({ id: canvasNodes.id }).from(canvasNodes);
    for (const n of existingNodes) await db.delete(canvasNodes).where(eq(canvasNodes.id, n.id));
    const existingStrokes = await db.select({ id: canvasStrokes.id }).from(canvasStrokes);
    for (const s of existingStrokes) await db.delete(canvasStrokes).where(eq(canvasStrokes.id, s.id));

    // Restore nodes
    for (const n of savedNodes) {
      await db.insert(canvasNodes).values({
        title: n.title, description: n.description || "", status: n.status || "not_started",
        owner: n.owner || "", estimatedHours: n.estimatedHours || null,
        x: n.x || 100, y: n.y || 100, connectedTo: typeof n.connectedTo === "string" ? n.connectedTo : JSON.stringify(n.connectedTo || []),
        createdBy: n.createdBy || "", lastEditedBy: n.lastEditedBy || "", userId: n.userId || null,
      });
    }

    // Restore strokes
    for (const s of savedStrokes) {
      await db.insert(canvasStrokes).values({
        points: typeof s.points === "string" ? s.points : JSON.stringify(s.points || []),
        color: s.color || "#000000", width: s.width || 2, createdBy: s.createdBy || "",
      });
    }

    return NextResponse.json({ ok: true, nodesRestored: savedNodes.length, strokesRestored: savedStrokes.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
