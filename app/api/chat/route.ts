import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { chatMessages, goals, canvasNodes } from "@/app/lib/db/schema";
import { eq, or, and, asc, desc, sql } from "drizzle-orm";
import { MASTER_EMAIL, EXECUTIVE_EMAILS, TECHNICAL_ADMINS } from "@/app/lib/store";

// ─── Tool declarations ───────────────────────────────────────────────

const TOOLS = [
  {
    name: "create_goal",
    description: "Create a new goal or milestone in any category.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" }, description: { type: "string" },
        horizon: { type: "string", enum: ["weekly", "monthly", "3m", "6m", "1y", "2y", "5y"] },
        category: { type: "string", enum: ["company", "personal", "executive"] },
        status: { type: "string", enum: ["not_started", "in_progress", "done", "blocked"] },
        owner: { type: "string" }, reasoning: { type: "string" },
        targetDate: { type: "string", description: "YYYY-MM-DD" },
        workstream: { type: "string", enum: ["network", "payment", "hardware", "app", "pipeline", "microops", "research", "sales", "fundraising", "marketing", "finance"] },
        pinned: { type: "boolean" }, estimatedHours: { type: "number" },
      },
      required: ["title", "horizon", "category"],
    },
  },
  {
    name: "update_goal",
    description: "Update an existing goal by title search. Can change status, owner, description, etc.",
    parameters: {
      type: "object",
      properties: {
        titleSearch: { type: "string", description: "Partial title match" },
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
    description: "Query goals with filters. Returns matching goals with all details.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["company", "personal", "executive", "all"] },
        horizon: { type: "string", enum: ["weekly", "monthly", "3m", "6m", "1y", "2y", "5y", "all"] },
        status: { type: "string", enum: ["not_started", "in_progress", "done", "blocked", "all"] },
        owner: { type: "string" },
        search: { type: "string", description: "Search in title and description" },
      },
    },
  },
  {
    name: "analyze_goals",
    description: "Analyze goal alignment, gaps, and priorities. Returns strategic analysis of current goals across horizons.",
    parameters: {
      type: "object",
      properties: {
        focus: { type: "string", enum: ["alignment", "gaps", "priorities", "blockers", "progress", "overview"] },
      },
      required: ["focus"],
    },
  },
  {
    name: "create_canvas_task",
    description: "Create a task card on the Technical canvas whiteboard.",
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
    name: "connect_canvas_tasks",
    description: "Connect two canvas tasks with a directed arrow. Use after creating tasks to build a workflow/flowchart. The arrow goes from source to target.",
    parameters: {
      type: "object",
      properties: {
        fromTitle: { type: "string", description: "Title (or partial title) of the source task" },
        toTitle: { type: "string", description: "Title (or partial title) of the target task" },
      },
      required: ["fromTitle", "toTitle"],
    },
  },
  {
    name: "batch_connect_canvas_tasks",
    description: "Connect multiple pairs of canvas tasks with arrows at once. Each connection is a fromTitle→toTitle pair. Use for building flowcharts efficiently.",
    parameters: {
      type: "object",
      properties: {
        connections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fromTitle: { type: "string" },
              toTitle: { type: "string" },
            },
            required: ["fromTitle", "toTitle"],
          },
        },
      },
      required: ["connections"],
    },
  },
  {
    name: "list_canvas_tasks",
    description: "List all tasks on the Technical canvas with details including their IDs for connecting.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "save_memory",
    description: "Save important information to persistent memory. Use for decisions, context, preferences, strategic insights, or anything worth remembering. Memories persist across all conversations.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Category/label (e.g. 'strategy', 'decision', 'preference', 'context')" },
        content: { type: "string", description: "The information to remember" },
        importance: { type: "string", enum: ["low", "medium", "high", "critical"], description: "How important this is" },
      },
      required: ["key", "content"],
    },
  },
  {
    name: "recall_memory",
    description: "Search persistent memories. Can filter by keyword or return all.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Optional keyword to filter memories" },
      },
    },
  },
  {
    name: "delete_memory",
    description: "Delete a specific memory by its key.",
    parameters: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
    },
  },
  {
    name: "delete_goal",
    description: "Delete a goal by title search. Use when user explicitly asks to remove/delete a goal.",
    parameters: {
      type: "object",
      properties: {
        titleSearch: { type: "string", description: "Partial title match to find the goal to delete" },
      },
      required: ["titleSearch"],
    },
  },
  {
    name: "batch_create_goals",
    description: "Create multiple goals at once. Use when extracting from meeting notes or setting up a plan.",
    parameters: {
      type: "object",
      properties: {
        goals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" }, horizon: { type: "string" }, category: { type: "string" },
              description: { type: "string" }, owner: { type: "string" }, status: { type: "string" },
              reasoning: { type: "string" }, targetDate: { type: "string" },
            },
            required: ["title", "horizon", "category"],
          },
        },
      },
      required: ["goals"],
    },
  },
  {
    name: "get_daily_summary",
    description: "Generate a daily summary of what happened: goals changed, tasks created, who did what.",
    parameters: { type: "object", properties: {} },
  },
];

// ─── Tool execution ──────────────────────────────────────────────────

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
      return `Created: "${created.title}" [${created.horizon}/${created.category}]${needsApproval ? " (pending approval)" : ""}`;
    }

    case "delete_goal": {
      const search = (args.titleSearch as string).toLowerCase();
      const all = await db.select().from(goals);
      const match = all.find((g) => g.title.toLowerCase().includes(search));
      if (!match) return `No goal found matching "${args.titleSearch}"`;
      // Permission check: master/exec can delete anything, others only personal
      if (match.category === "company" && !isMaster && !isExec) return `Permission denied: only admins can delete company goals.`;
      if (match.category === "executive" && !isExec) return `Permission denied: only executives can delete executive goals.`;
      if (match.category === "personal" && match.userId !== userId) return `Permission denied: can't delete another user's personal goal.`;
      await db.delete(goals).where(eq(goals.id, match.id));
      return `Deleted goal: "${match.title}"`;
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
      if (args.search) {
        const s = (args.search as string).toLowerCase();
        filtered = filtered.filter((g) => g.title.toLowerCase().includes(s) || g.description?.toLowerCase().includes(s));
      }
      if (!filtered.length) return "No goals found.";
      return `Found ${filtered.length} goals:\n` + filtered.slice(0, 30).map((g) =>
        `• [${g.horizon}/${g.category}] "${g.title}" — ${g.status}${g.owner ? ` (${g.owner})` : ""}${g.targetDate ? ` →${g.targetDate}` : ""}${g.estimatedHours ? ` ~${g.estimatedHours}h` : ""}`
      ).join("\n");
    }

    case "analyze_goals": {
      const all = await db.select().from(goals).orderBy(asc(goals.order));
      const focus = args.focus as string;
      const company = all.filter((g) => g.category === "company" && g.approved);
      const byHorizon: Record<string, typeof all> = {};
      for (const g of company) { (byHorizon[g.horizon] ??= []).push(g); }
      const byStatus: Record<string, number> = {};
      for (const g of company) { byStatus[g.status] = (byStatus[g.status] || 0) + 1; }

      if (focus === "blockers") {
        const blocked = company.filter((g) => g.status === "blocked");
        return blocked.length ? `${blocked.length} blocked goals:\n${blocked.map((g) => `• "${g.title}" (${g.owner || "unassigned"})`).join("\n")}` : "No blocked goals.";
      }
      if (focus === "progress") {
        return `Progress: ${byStatus.done || 0} done, ${byStatus.in_progress || 0} active, ${byStatus.not_started || 0} pending, ${byStatus.blocked || 0} blocked out of ${company.length} total.`;
      }
      if (focus === "gaps") {
        const horizons = ["weekly", "monthly", "6m", "1y", "2y", "5y"];
        const empty = horizons.filter((h) => !(byHorizon[h]?.length));
        return empty.length ? `Missing goals in: ${empty.join(", ")}` : "All horizons have goals set.";
      }
      if (focus === "priorities") {
        const active = company.filter((g) => g.status === "in_progress");
        const weekly = byHorizon["weekly"] || [];
        return `Active priorities:\n${active.slice(0, 10).map((g) => `• [${g.horizon}] "${g.title}"`).join("\n")}\n\nWeekly focus:\n${weekly.slice(0, 5).map((g) => `• "${g.title}" — ${g.status}`).join("\n")}`;
      }
      // overview / alignment
      return `Goal overview: ${company.length} company goals\n${Object.entries(byHorizon).map(([h, gs]) => `  ${h}: ${gs.length} goals (${gs.filter((g) => g.status === "done").length} done)`).join("\n")}\n\nStatus: ${Object.entries(byStatus).map(([s, c]) => `${s}: ${c}`).join(", ")}`;
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

    case "connect_canvas_tasks": {
      const tasks = await db.select().from(canvasNodes);
      const fromSearch = (args.fromTitle as string).toLowerCase();
      const toSearch = (args.toTitle as string).toLowerCase();
      const fromNode = tasks.find((t) => t.title.toLowerCase().includes(fromSearch));
      const toNode = tasks.find((t) => t.title.toLowerCase().includes(toSearch));
      if (!fromNode) return `No task found matching "${args.fromTitle}"`;
      if (!toNode) return `No task found matching "${args.toTitle}"`;
      if (fromNode.id === toNode.id) return "Cannot connect a task to itself.";
      const existing = JSON.parse((fromNode.connectedTo as string) || "[]") as string[];
      if (existing.includes(toNode.id)) return `Already connected: "${fromNode.title}" → "${toNode.title}"`;
      existing.push(toNode.id);
      await db.update(canvasNodes).set({ connectedTo: JSON.stringify(existing), updatedAt: new Date() }).where(eq(canvasNodes.id, fromNode.id));
      return `Connected: "${fromNode.title}" → "${toNode.title}"`;
    }

    case "batch_connect_canvas_tasks": {
      const connections = args.connections as Array<{ fromTitle: string; toTitle: string }>;
      const tasks = await db.select().from(canvasNodes);
      const results: string[] = [];
      // Cache connectedTo updates to batch them
      const updates: Record<string, string[]> = {};
      for (const { fromTitle, toTitle } of connections) {
        const fromNode = tasks.find((t) => t.title.toLowerCase().includes(fromTitle.toLowerCase()));
        const toNode = tasks.find((t) => t.title.toLowerCase().includes(toTitle.toLowerCase()));
        if (!fromNode) { results.push(`✗ "${fromTitle}" not found`); continue; }
        if (!toNode) { results.push(`✗ "${toTitle}" not found`); continue; }
        if (fromNode.id === toNode.id) { results.push(`✗ "${fromTitle}" → self`); continue; }
        if (!updates[fromNode.id]) {
          updates[fromNode.id] = JSON.parse((fromNode.connectedTo as string) || "[]");
        }
        if (!updates[fromNode.id].includes(toNode.id)) {
          updates[fromNode.id].push(toNode.id);
          results.push(`✓ "${fromNode.title}" → "${toNode.title}"`);
        } else {
          results.push(`– "${fromNode.title}" → "${toNode.title}" (already connected)`);
        }
      }
      // Write all updates
      for (const [nodeId, conns] of Object.entries(updates)) {
        await db.update(canvasNodes).set({ connectedTo: JSON.stringify(conns), updatedAt: new Date() }).where(eq(canvasNodes.id, nodeId));
      }
      return `Connected ${results.filter((r) => r.startsWith("✓")).length}/${connections.length} pairs:\n${results.join("\n")}`;
    }

    case "list_canvas_tasks": {
      const tasks = await db.select().from(canvasNodes).orderBy(asc(canvasNodes.createdAt));
      if (!tasks.length) return "No tasks on the Technical canvas.";
      return `${tasks.length} canvas tasks:\n${tasks.map((t) => {
        const conns = JSON.parse((t.connectedTo as string) || "[]") as string[];
        const connNames = conns.map((cid) => tasks.find((x) => x.id === cid)?.title || "?").join(", ");
        return `• "${t.title}" — ${t.status}${t.owner ? ` @${t.owner.split("@")[0]}` : ""}${connNames ? ` → [${connNames}]` : ""}`;
      }).join("\n")}`;
    }

    case "save_memory": {
      const key = args.key as string;
      const importance = (args.importance as string) || "medium";
      // Check if memory with same key exists — update it
      const existing = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "system")));
      const found = existing.find((m) => m.content.startsWith(`[MEMORY:${key}]`));
      if (found) {
        await db.update(chatMessages).set({ content: `[MEMORY:${key}:${importance}] ${args.content}` }).where(eq(chatMessages.id, found.id));
        return `Updated memory: "${key}"`;
      }
      await db.insert(chatMessages).values({ userId, role: "system", content: `[MEMORY:${key}:${importance}] ${args.content}` });
      return `Saved memory: "${key}" (${importance})`;
    }

    case "recall_memory": {
      const mems = await db.select().from(chatMessages).where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "system")));
      if (!mems.length) return "No saved memories.";
      let filtered = mems;
      if (args.search) {
        const s = (args.search as string).toLowerCase();
        filtered = mems.filter((m) => m.content.toLowerCase().includes(s));
      }
      if (!filtered.length) return `No memories matching "${args.search}".`;
      return filtered.map((m) => {
        const match = m.content.match(/\[MEMORY:([^:\]]+):?([^\]]*)\]\s*(.*)/);
        if (match) return `• **${match[1]}** ${match[2] ? `(${match[2]})` : ""}: ${match[3]}`;
        return `• ${m.content}`;
      }).join("\n");
    }

    case "delete_memory": {
      const key = args.key as string;
      const mems = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "system")));
      const found = mems.find((m) => m.content.includes(`[MEMORY:${key}`));
      if (!found) return `No memory found with key "${key}".`;
      await db.delete(chatMessages).where(eq(chatMessages.id, found.id));
      return `Deleted memory: "${key}"`;
    }

    case "batch_create_goals": {
      const goalList = args.goals as Array<Record<string, unknown>>;
      const created: string[] = [];
      for (const g of goalList) {
        const needsApproval = g.category === "company" && !isMaster && !isExec;
        await db.insert(goals).values({
          userId: g.category === "personal" ? userId : null,
          title: g.title as string, description: (g.description as string) || "",
          status: (g.status as string) || "not_started", horizon: g.horizon as string,
          category: (g.category as string) || "company", owner: (g.owner as string) || "",
          reasoning: (g.reasoning as string) || "", targetDate: (g.targetDate as string) || null,
          workstream: null, pinned: false, estimatedHours: null,
          order: Math.floor(Date.now() / 1000) % 2000000000,
          approved: !needsApproval, proposedBy: needsApproval ? email : null,
        });
        created.push(g.title as string);
      }
      return `Created ${created.length} goals:\n${created.map((t) => `• "${t}"`).join("\n")}`;
    }

    case "get_daily_summary": {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const allGoals = await db.select().from(goals);
      const recentGoals = allGoals.filter((g) => g.updatedAt && new Date(g.updatedAt) >= today);
      const tasks = await db.select().from(canvasNodes);
      const recentTasks = tasks.filter((t) => t.updatedAt && new Date(t.updatedAt) >= today);

      let summary = `**Daily Summary** (${today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })})\n\n`;
      if (recentGoals.length) {
        summary += `**Goals updated today:** ${recentGoals.length}\n`;
        summary += recentGoals.slice(0, 10).map((g) => `• "${g.title}" → ${g.status}`).join("\n") + "\n\n";
      }
      if (recentTasks.length) {
        summary += `**Canvas tasks updated:** ${recentTasks.length}\n`;
        summary += recentTasks.slice(0, 10).map((t) => `• "${t.title}" → ${t.status}`).join("\n") + "\n\n";
      }
      const blocked = allGoals.filter((g) => g.status === "blocked");
      if (blocked.length) summary += `**Blocked:** ${blocked.length} items need attention\n`;
      if (!recentGoals.length && !recentTasks.length) summary += "No updates today yet.";
      return summary;
    }

    default: return `Unknown tool: ${name}`;
  }
}

// ─── Main POST handler ───────────────────────────────────────────────

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

    // Last 50 conversation messages
    const history = await db.select().from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), or(eq(chatMessages.role, "user"), eq(chatMessages.role, "assistant"))))
      .orderBy(desc(chatMessages.timestamp)).limit(50);
    history.reverse();

    // Always-loaded memories (Tier 1 — like OpenClaw's MEMORY.md)
    const memories = await db.select().from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "system")));

    // Goal counts for quick context
    const allGoals = await db.select().from(goals).orderBy(asc(goals.order));
    const company = allGoals.filter((g) => g.category === "company" && g.approved);
    const personal = allGoals.filter((g) => g.category === "personal" && g.userId === userId);
    const exec = EXECUTIVE_EMAILS.includes(userEmail) ? allGoals.filter((g) => g.category === "executive") : [];
    const canvas = await db.select().from(canvasNodes).orderBy(asc(canvasNodes.createdAt));

    const isMaster = userEmail === MASTER_EMAIL;
    const isExec = EXECUTIVE_EMAILS.includes(userEmail);
    const roleName = isMaster ? "MASTER ADMIN" : isExec ? "Executive" : TECHNICAL_ADMINS.includes(userEmail) ? "Tech Admin" : "Team member";

    // Build system prompt (OpenClaw-inspired: tiered context)
    const systemPrompt = `You are the **Microgoals AI** — an autonomous, multi-turn agent embedded in Micro-AGI's goal and task management platform.

## Identity
User: **${session.user.name}** (${userEmail}) — ${roleName}
Page: ${page || "home"} | Date: ${new Date().toISOString().slice(0, 10)}
Platform: Micro-AGI is a robotics data company building the world's leading data infrastructure for embodied AI.

## Persistent Memory (always loaded)
${memories.length > 0 ? memories.map((m) => {
  const match = m.content.match(/\[MEMORY:([^:\]]+):?([^\]]*)\]\s*(.*)/);
  return match ? `• **${match[1]}** ${match[2] ? `[${match[2]}]` : ""}: ${match[3]}` : `• ${m.content}`;
}).join("\n") : "(No memories saved yet — use save_memory to build context over time)"}

## Live Context
**Company goals:** ${company.length} total (${company.filter((g) => g.status === "done").length} done, ${company.filter((g) => g.status === "in_progress").length} active, ${company.filter((g) => g.status === "blocked").length} blocked)
${company.filter((g) => g.status === "in_progress" || g.status === "blocked").slice(0, 15).map((g) => `  [${g.horizon}] "${g.title}" ${g.status}${g.owner ? ` (${g.owner})` : ""}${g.targetDate ? ` →${g.targetDate}` : ""}`).join("\n")}

**Personal goals:** ${personal.length}
${personal.slice(0, 8).map((g) => `  [${g.horizon}] "${g.title}" ${g.status}`).join("\n") || "  (none)"}

${exec.length > 0 ? `**Executive goals:** ${exec.length}\n${exec.slice(0, 8).map((g) => `  [${g.horizon}] "${g.title}" ${g.status}`).join("\n")}` : ""}

**Technical canvas:** ${canvas.length} tasks
${canvas.slice(0, 10).map((t) => `  "${t.title}" ${t.status}${t.owner ? ` @${t.owner.split("@")[0]}` : ""}`).join("\n") || "  (empty)"}

## Agent Behavior
1. **Proactive**: Don't just answer — anticipate needs. If user asks about strategy, also flag blockers.
2. **Tool-first**: Always use tools to take action. Don't describe what you'd do — do it.
3. **Memory-aware**: Save important decisions, context shifts, and preferences automatically. Recall when relevant.
4. **Multi-action**: Chain multiple tool calls per turn. "Create 3 goals and analyze progress" = 4 tool calls.
5. **Strategic**: You understand Micro-AGI's business — data collection, European focus, robotic deployment, fundraising.
6. **Concise**: No filler. Lead with the action or insight. Reference goals by name.
7. **Accountable**: After using tools, ALWAYS state exactly what you did with specific titles. "I created 3 goals: X, Y, Z" — not "I added some goals". This is critical for your memory across turns.

## Tool Usage Rules
- User says "add/create/set" → **create_goal** or **create_canvas_task** or **batch_create_goals**
- User says "update/change/mark/move" → **update_goal**
- User says "delete/remove" → **delete_goal**
- User pastes a flowchart/mermaid/workflow → **create_canvas_task** for each node (with x,y positions for layout) + **batch_connect_canvas_tasks** for all edges. IMPORTANT: space nodes with x gaps of ~250px per column and y gaps of ~80px per row. Arrange in a left-to-right flow. Example: column 1 at x=100, column 2 at x=350, column 3 at x=600. Rows at y=100, y=180, y=260.
- User says "connect X to Y" → **connect_canvas_tasks**
- User says "show/list/what are" → **list_goals** or **list_canvas_tasks**
- User says "analyze/assess/how are we" → **analyze_goals**
- User says "remember/note/save" → **save_memory**
- User pastes meeting notes → **batch_create_goals** (extract all actionable items)
- User asks for status/standup/summary → **get_daily_summary**
- Start of new topic → consider **recall_memory** if context might help`;

    const contents = history.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.content }],
    }));

    // Multi-turn tool loop (max 8 iterations for complex chains)
    let finalReply = "";
    const currentContents = [...contents];

    for (let turn = 0; turn < 8; turn++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
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

      // Execute all tool calls and track what happened
      const results: { functionResponse: { name: string; response: { result: string } } }[] = [];
      const actionLog: string[] = [];
      for (const fc of calls) {
        const c = fc.functionCall as { name: string; args: Record<string, unknown> };
        const result = await executeTool(c.name, c.args || {}, userId, userEmail);
        results.push({ functionResponse: { name: c.name, response: { result } } });
        actionLog.push(`[${c.name}] ${result}`);
      }

      currentContents.push({ role: "model", parts } as typeof currentContents[number]);
      currentContents.push({ role: "user", parts: results } as unknown as typeof currentContents[number]);
    }

    // If agent only used tools with no text, build reply from action log
    if (!finalReply) finalReply = "Done.";

    await db.insert(chatMessages).values({ userId, role: "assistant", content: finalReply });
    return NextResponse.json({ reply: finalReply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
