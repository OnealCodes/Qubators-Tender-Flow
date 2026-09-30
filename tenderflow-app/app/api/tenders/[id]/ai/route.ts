import { NextResponse } from "next/server";
import { applyAssessments, listAssessments, refineTender } from "../../../../../lib/ai-refine";
import { limited, rateLimitedResponse } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ assessments: await listAssessments(id) });
}

// AI refinement: heuristic matrix first (already stored), Gemini classifies.
// Never edits rows by itself — suggestions wait for Apply.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = limited(req, "heavy");
  if (gate.limited) return rateLimitedResponse(gate.retryAfter);
  const { id } = await ctx.params;
  try {
    const { summary, assessments } = await refineTender(id);
    return NextResponse.json({ summary, assessments }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI refinement failed." }, { status: 502 });
  }
}

// Apply drop suggestions (supersede). Merges stay manual by design.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = limited(req, "heavy");
  if (gate.limited) return rateLimitedResponse(gate.retryAfter);
  const { id } = await ctx.params;
  const { applied } = await applyAssessments(id);
  return NextResponse.json({ applied });
}
