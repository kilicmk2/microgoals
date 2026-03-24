import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";

export async function GET() {
  const session = await auth();

  return NextResponse.json({
    hasSession: !!session,
    user: session?.user ?? null,
    hasDbUrl: !!process.env.DATABASE_URL,
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasGoogleId: !!process.env.AUTH_GOOGLE_ID,
  });
}
