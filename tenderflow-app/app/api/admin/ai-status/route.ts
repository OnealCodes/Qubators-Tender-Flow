import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Key presence only — the value is never returned, logged, or committed.
export async function GET() {
  const key = process.env.GEMINI_API_KEY ?? "";
  return NextResponse.json({
    configured: key.trim().length >= 10,
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-flash",
  });
}
