import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getDb } from "@/app/lib/db";
import { chatMessages } from "@/app/lib/db/schema";
import { goals } from "@/app/lib/db/schema";
import { eq, or, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  try {
    const { message } = await req.json();

    // Save user message
    await getDb().insert(chatMessages).values({
      userId: session.user.id,
      role: "user",
      content: message,
    });

    // Get all goals for context
    const allGoals = await getDb()
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

    const systemPrompt = `You are an AI assistant for Microgoals — a company goal-tracking platform. You help the team manage, summarize, and refine their goals.

Current goals:
${goalsContext || "(No goals set yet)"}

You can:
1. Summarize goals by time horizon or category
2. Suggest new goals or improvements
3. Analyze alignment between short-term and long-term goals
4. Help extract goals from meeting notes
5. Provide strategic recommendations

When suggesting goal changes, describe them clearly. Be concise, direct, and strategic. Use plain language.

If the user pastes meeting notes, extract actionable goals and suggest which time horizon they belong to.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Gemini API error: ${response.status} — ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";

    // Save assistant message
    await getDb().insert(chatMessages).values({
      userId: session.user.id,
      role: "assistant",
      content: reply,
    });

    return NextResponse.json({ reply });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
