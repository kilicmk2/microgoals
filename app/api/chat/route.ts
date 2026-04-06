import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { chatMessages, goals, canvasNodes } from "@/app/lib/db/schema";
import { eq, or, and, asc, desc } from "drizzle-orm";
import { MASTER_EMAIL, EXECUTIVE_EMAILS, TECHNICAL_ADMINS } from "@/app/lib/store";

const TOOLS = [
  {
    name: "create_goal",
    description: "Create a new goal or milestone.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        horizon: { type: "string", enum: ["weekly", "monthly", "3m", "6m", "1y", "2y", "5y"] },
        category: { type: "string", enum: ["company", "personal", "executive"] },
        status: { type: "string", enum: ["not_started", "in_progress", "done", "blocked"] },
        owner: { type: "string" },
        reasoning: { type: "string" },
        targetDate: { type: "string" },
        workstream: { type: "string", enum: ["network", "payment", "hardware", "app", "pipeline", "microops", "research", "sales", "fundraising", "marketing", "finance"] },
        pinned: { type: "boolean" },
        estimatedHours: { type: "number" },
      },
      required: ["title", "horizon", "category"],
    },
  },
  {
    name: "update_goal",
    description: "Update an existing goal by title search.",
    parameters: {
      type: "object",
      properties: {
        titleSearch: { type: "string" },
        updates: {
          type: "object",
          properties: {
            title: { type: "string" }, description: { type: "string" },
            status: { type: "string", enum: ["not_started", "in_progress", "done", "blocked"] },
            owner: { type: "string" }, reasoning: { type: "string" },
            targetDate: { type: "string" }, estimatedHours: { type: "number" }, pinned: { type: "boolean" },
          },
        },
      },
      required: ["titleSearch", "updates"],
    },
  },
  {
    name: "list_goals",
    description: "List goals filtered by category, horizon, status, or owner.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["company", "personal", "executive", "all"] },
        horizon: { type: "string", enum: ["weekly", "monthly", "3m", "6m", "1y", "2y", "5y", "all"] },
        status: { type: "string", enum: ["not_started", "in_progress", "done", "blocked", "all"] },
        owner: { type: "string" },
      },
    },
  },
  {
    name: "create_canvas_task",
    description: "Create a task on the Technical canvas whiteboard.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" }, description: { type: "string" }, owner: { type: "string" },
        status: { type: "string", enum: ["not_started", "in_progress", "done", "blocked"] },
        estimatedHours: { type: "number" }, x: { type: "number" }, y: { type: "number" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_canvas_tasks",
    description: "List all tasks on the Technical canvas.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "save_memory",
    description: "Save important info to persistent memory across conversations.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Short label for this memory" },
        content: { type: "string", description: "The info to remember" },
      },
      required: ["key", "content"],
    },
  },
  {
    name: "recall_memory",
    description: "Retrieve all saved memories.",
    parameters: { type: "object", properties: {} },
  },
];

async function executeTool(name: string, args: Record<string, unknown>, userId: string, email: string): Promise<string> {
  const db = getDb();
  const isMaster = email === MASTER_EMAIL;
  const isExec = EXECUTIVE_EMAILS.includes(email);

  switch (name) {
    case "create_goal": {
      const needsApproval = args.category === "company" && !isMaster && !isExec;
      const [created] = await db.insert(goals).values({
        userId: args.category === "personal" ? userId : null,
        title: args.title as string, description: (args.description as string) || "",
        status: (args.status as string) || "not_started", horizon: args.horizon as string,
        category: args.category as string, owner: (args.owner as string) || "",
        reasoning: (args.reasoning as string) || "", targetDate: (args.targetDate as string) || null,
        workstream: (args.workstream as string) || null,
        pinned: (isMaster || isExec) ? (args.pinned as boolean || false) : false,
        estimatedHours: (args.estimatedHours as number) || null,
        order: Math.floor(Date.now() / 1000) % 2000000000,
        approved: !needsApproval, proposedBy: needsApproval ? email : null,
      }).returning();
      return `Created goal: "${created.title}" [${created.horizon}/${created.category}]${needsApproval ? " (pending approval)" : ""}`;
    }
    case "update_goal": {
      const search = (args.titleSearch as string).toLowerCase();
      const all = await db.select().from(goals);
      const match = all.find((g) => g.title.toLowerCase().includes(search));
      if (!match) return `No goal found matching "${args.titleSearch}"`;
      const updates = args.updates as Record<string, unknown>;
      const set: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(updates)) if (v !== undefined) set[k] = v;
      await db.update(goals).set(set).where(eq(goals.id, match.id));
      return `Updated "${match.title}" — changed: ${Object.keys(updates).join(", ")}`;
    }
    case "list_goals": {
      let filtered = await db.select().from(goals).orderBy(asc(goals.order));
      if (args.category && args.category !== "all") filtered = filtered.filter((g) => g.category === args.category);
      if (args.horizon && args.horizon !== "all") filtered = filtered.filter((g) => g.horizon === args.horizon);
      if (args.status && args.status !== "all") filtered = filtered.filter((g) => g.status === args.status);
      if (args.owner) filtered = filtered.filter((g) => g.owner?.toLowerCase().includes((args.owner as string).toLowerCase()));
      if (!filtered.length) return "No goals found.";
      return filtered.slice(0, 30).map((g) =>
        `• [${g.horizon}/${g.category}] "${g.title}" — ${g.status}${g.owner ? ` (${g.owner})` : ""}${g.targetDate ? ` target:${g.targetDate}` : ""}`
      ).join("\n");
    }
    case "create_canvas_task": {
      const [node] = await db.insert(canvasNodes).values({
        userId: email, title: args.title as string, description: (args.description as string) || "",
        status: (args.status as string) || "not_started", owner: (args.owner as string) || "",
        estimatedHours: (args.estimatedHours as number) || null,
        x: (args.x as number) || 200, y: (args.y as number) || 200,
        connectedTo: "[]", createdBy: email, lastEditedBy: email,
      }).returning();
      return `Created canvas task: "${node.title}"`;
    }
    case "list_canvas_tasks": {
      const tasks = await db.select().from(canvasNodes).orderBy(asc(canvasNodes.createdAt));
      if (!tasks.length) return "No tasks on the Technical canvas.";
      return tasks.map((t) => `• "${t.title}" — ${t.status}${t.owner ? ` @${t.owner.split("@")[0]}` : ""}${t.estimatedHours ? ` ~${t.estimatedHours}h` : ""}`).join("\n");
    }
    case "save_memory": {
      await db.insert(chatMessages).values({ userId, role: "system", content: `[MEMORY:${args.key}] ${args.content}` });
      return `Saved memory: "${args.key}"`;
    }
    case "recall_memory": {
      const mems = await db.select().from(chatMessages).where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "system")));
      if (!mems.length) return "No saved memories.";
      return mems.map((m) => m.content).join("\n");
    }
    default: return `Unknown tool: ${name}`;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.email || session.user.id || "";
  const userEmail = session.user.email || "";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });

  try {
    const { message, page } = await req.json();
    const db = getDb();

    await db.insert(chatMessages).values({ userId, role: "user", content: message });

    // Last 50 user/assistant messages
    const history = await db.select().from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), or(eq(chatMessages.role, "user"), eq(chatMessages.role, "assistant"))))
      .orderBy(desc(chatMessages.timestamp)).limit(50);
    history.reverse();

    // Memories
    const memories = await db.select().from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "system")));

    // Goals summary
    const allGoals = await db.select().from(goals).orderBy(asc(goals.order));
    const companyGoals = allGoals.filter((g) => g.category === "company" && g.approved);
    const personalGoals = allGoals.filter((g) => g.category === "personal" && g.userId === userId);
    const execGoals = EXECUTIVE_EMAILS.includes(userEmail) ? allGoals.filter((g) => g.category === "executive") : [];

    const canvasTasks = await db.select().from(canvasNodes).orderBy(asc(canvasNodes.createdAt));

    const isMaster = userEmail === MASTER_EMAIL;
    const isExec = EXECUTIVE_EMAILS.includes(userEmail);

    const systemPrompt = `You are the Microgoals AI — an intelligent agent for Micro-AGI's goal and task platform. You have persistent memory and full tool access.

## User
${session.user.name} (${userEmail}) — ${isMaster ? "MASTER ADMIN" : isExec ? "Executive" : TECHNICAL_ADMINS.includes(userEmail) ? "Tech Admin" : "Team member"}
Page: ${page || "home"} | Date: ${new Date().toISOString().slice(0, 10)}

## Memories
${memories.length > 0 ? memories.map((m) => m.content).join("\n") : "(none)"}

## Company goals (${companyGoals.length})
${companyGoals.slice(0, 25).map((g) => `[${g.horizon}] "${g.title}" ${g.status}${g.owner ? ` (${g.owner})` : ""}${g.targetDate ? ` →${g.targetDate}` : ""}`).join("\n") || "(none)"}

## Personal goals (${personalGoals.length})
${personalGoals.slice(0, 10).map((g) => `[${g.horizon}] "${g.title}" ${g.status}`).join("\n") || "(none)"}

${execGoals.length > 0 ? `## Executive goals (${execGoals.length})\n${execGoals.slice(0, 10).map((g) => `[${g.horizon}] "${g.title}" ${g.status}`).join("\n")}` : ""}

## Canvas (${canvasTasks.length})
${canvasTasks.slice(0, 15).map((t) => `"${t.title}" ${t.status}${t.owner ? ` @${t.owner.split("@")[0]}` : ""}`).join("\n") || "(empty)"}

## Rules
- Be concise, strategic, direct. No fluff.
- Use tools proactively. When user says "add/create" → create_goal or create_canvas_task.
- When user says "update/change/mark" → update_goal.
- When user says "show/list/what" → list_goals or list_canvas_tasks.
- When user mentions something to remember → save_memory.
- Reference existing goals by name.
- For meeting notes: extract and create multiple goals.
- Chain multiple tool calls when needed.
- Always confirm actions taken.`;

    const contents = history.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.content }],
    }));

    // Multi-turn tool loop (max 5)
    let finalReply = "";
    const currentContents = [...contents];

    for (let turn = 0; turn < 5; turn++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: currentContents,
            generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
            tools: [{ function_declarations: TOOLS }],
          }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `Gemini ${res.status}: ${err.substring(0, 200)}` }, { status: 500 });
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts;
      if (!parts) break;

      const texts = parts.filter((p: Record<string, unknown>) => p.text);
      const calls = parts.filter((p: Record<string, unknown>) => p.functionCall);

      if (texts.length) finalReply += texts.map((p: Record<string, unknown>) => p.text).join("");
      if (!calls.length) break;

      const results: { functionResponse: { name: string; response: { result: string } } }[] = [];
      for (const fc of calls) {
        const c = fc.functionCall as { name: string; args: Record<string, unknown> };
        const result = await executeTool(c.name, c.args || {}, userId, userEmail);
        results.push({ functionResponse: { name: c.name, response: { result } } });
      }

      currentContents.push({ role: "model", parts } as typeof currentContents[number]);
      currentContents.push({ role: "user", parts: results } as unknown as typeof currentContents[number]);
    }

    if (!finalReply) finalReply = "Done.";

    await db.insert(chatMessages).values({ userId, role: "assistant", content: finalReply });
    return NextResponse.json({ reply: finalReply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
