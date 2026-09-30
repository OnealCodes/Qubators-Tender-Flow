import { NextResponse } from "next/server";
import { aiExtractTender } from "../../../../../../lib/ai-extract";
import { logActivity } from "../../../../../../lib/collab";
import { limited, rateLimitedResponse } from "../../../../../../lib/rate-limit";
import { saveRun } from "../../../../../../lib/requirements";

export const runtime = "nodejs";
export const maxDuration = 180;

// Two-pass AI structuring: locate bid sections, extract exact-wording rows
// only inside them, verify, then save as a new version (human edits win).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = limited(req, "heavy");
  if (gate.limited) return rateLimitedResponse(gate.retryAfter);
  const { id } = await ctx.params;
  try {
    const { requirements, meta } = await aiExtractTender(id);
    const { diff, backend } = await saveRun(id, requirements, "gemini/v1", meta);
    await logActivity(id, "ai_structure", {
      version: diff.version,
      rows: diff.requirement_count,
      from: (meta as { ai_structured_from?: string[] }).ai_structured_from ?? [],
    });
    return NextResponse.json({ backend, diff, meta }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI structuring failed." }, { status: 502 });
  }
}

