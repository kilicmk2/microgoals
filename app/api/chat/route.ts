import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { chatMessages, goals } from "@/app/lib/db/schema";
import { eq, or, and, asc } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key not configured on server" }, { status: 500 });
  }

  try {
    const { message } = await req.json();
    const db = getDb();

    // Save user message
    await db.insert(chatMessages).values({
      userId: session.user.id,
      role: "user",
      content: message,
    });

    // Get full conversation history for context
    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, session.user.id))
      .orderBy(asc(chatMessages.timestamp));

    // Get all goals for context
    const allGoals = await db
      .select()
      .from(goals)
      .where(
        or(
          eq(goals.category, "company"),
          and(eq(goals.category, "personal"), eq(goals.userId, session.user.id))
        )
      );

    const goalsContext = allGoals
      .map(
        (g) =>
          `[${g.horizon}/${g.category}] "${g.title}" — status: ${g.status}${g.description ? `, desc: ${g.description}` : ""}${g.reasoning ? `, why: ${g.reasoning}` : ""}${g.owner ? `, owner: ${g.owner}` : ""}`
      )
      .join("\n");

    const systemPrompt = `You are an AI assistant for Microgoals — a company goal-tracking platform for Micro-AGI, a robotics data company. You have full context of all company and personal goals. You remember the full conversation history.

User: ${session.user.name} (${session.user.email})

Current goals:
${goalsContext || "(No goals set yet)"}

You can:
1. Summarize goals by time horizon (weekly, monthly, 6m, 1y, 2y, 5y)
2. Analyze alignment between short-term execution and long-term strategy
3. Extract actionable goals from meeting notes or transcripts
4. Suggest priorities, flag blocked items, identify gaps
5. Help refine goal descriptions and reasoning
6. CREATE goals directly — output a JSON block like this to create a goal:
\`\`\`goal
{"title":"Goal title","horizon":"weekly","category":"personal","description":"optional","reasoning":"why it matters","owner":"name","status":"not_started"}
\`\`\`
Valid horizons: weekly, monthly, 6m, 1y, 2y, 5y
Valid categories: company, personal
Valid statuses: not_started, in_progress, done, blocked

You can include multiple \`\`\`goal blocks in one response to create multiple goals.
When the user asks you to add a goal, create it using the goal block. When they paste meeting notes, extract goals and create them.

Be concise, direct, and strategic. Reference specific existing goals by name when relevant.`;

    // Build conversation for Gemini (full history)
    const contents = history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Gemini error ${response.status}: ${errText.substring(0, 200)}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";

    // Extract and create goals from ```goal blocks
    const goalBlocks = reply.match(/```goal\n([\s\S]*?)```/g) || [];
    const createdGoals: string[] = [];

    for (const block of goalBlocks) {
      try {
        const json = block.replace(/```goal\n?/, "").replace(/```/, "").trim();
        const goalData = JSON.parse(json);
        const isMaster = session.user.email === "bercan.kilic@micro-agi.com";
        const needsApproval = goalData.category === "company" && !isMaster;

        await db.insert(goals).values({
          userId: goalData.category === "personal" ? session.user.id : null,
          title: goalData.title,
          description: goalData.description || "",
          status: goalData.status || "not_started",
          horizon: goalData.horizon,
          category: goalData.category || "company",
          owner: goalData.owner || "",
          reasoning: goalData.reasoning || "",
          pinned: false,
          order: Date.now(),
          approved: !needsApproval,
          proposedBy: needsApproval ? (session.user.email ?? "") : null,
        });
        createdGoals.push(goalData.title);
      } catch {
        // Skip malformed goal blocks
      }
    }

    // Clean reply — remove goal blocks from displayed text
    let cleanReply = reply.replace(/```goal\n[\s\S]*?```/g, "").trim();
    if (createdGoals.length > 0) {
      cleanReply += `\n\n✓ Created ${createdGoals.length} goal${createdGoals.length > 1 ? "s" : ""}: ${createdGoals.join(", ")}`;
    }

    // Save cleaned assistant message
    await db.insert(chatMessages).values({
      userId: session.user.id,
      role: "assistant",
      content: cleanReply,
    });

    return NextResponse.json({ reply: cleanReply, createdGoals });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
