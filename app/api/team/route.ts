import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { canvasNodes } from "@/app/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get unique emails from canvas nodes createdBy + goals owners
    // This gives us people who have actually used the system
    const result = await getDb()
      .selectDistinct({ email: canvasNodes.createdBy })
      .from(canvasNodes)
      .where(sql`${canvasNodes.createdBy} IS NOT NULL`);

    const emails = result.map((r) => r.email).filter(Boolean) as string[];

    // Also include current user
    if (session.user.email && !emails.includes(session.user.email)) {
      emails.push(session.user.email);
    }

    // Hard-code known team for now (since not all may have logged in yet)
    const knownTeam = [
      "bercan.kilic@micro-agi.com",
      "nico.nussbaum@micro-agi.com",
      "addy@micro-agi.com",
      "anton@micro-agi.com",
      "artjem@micro-agi.com",
      "yoan@micro-agi.com",
      "zeno@micro-agi.com",
      "jan@micro-agi.com",
      "royce@micro-agi.com",
      "aaron@micro-agi.com",
    ];

    const all = [...new Set([...emails, ...knownTeam])].sort();
    return NextResponse.json(all);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
