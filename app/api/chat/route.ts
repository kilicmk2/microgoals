import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { message, goals, apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key is required" }, { status: 400 });
    }

    const goalsContext = goals
      .map(
        (g: { title: string; status: string; horizon: string; category: string; description: string; reasoning: string; owner: string }) =>
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
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: message }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json(
        { error: `Gemini API error: ${response.status} — ${err}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";

    return NextResponse.json({ reply });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
