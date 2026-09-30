import { NextResponse } from "next/server";
import { aiExtractTender } from "../../../../../lib/ai-extract";
import { logActivity } from "../../../../../lib/collab";
import { isGeminiConfigured } from "../../../../../lib/gemini";
import { limited, rateLimitedResponse } from "../../../../../lib/rate-limit";
import { extractRequirements } from "../../../../../lib/extract";
import { getActive, saveRun } from "../../../../../lib/requirements";
import { getTender } from "../../../../../lib/tenders";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { requirements, deliverables, backend } = await getActive(id);
  return NextResponse.json({ backend, requirements, deliverables });
}

// Run extraction: heuristic first (always saved — instant, offline, auditable),
// then Gemini two-pass structuring automatically when a key is configured.
// AI rows become the active version; the heuristic version stays in history.
// If AI is missing or fails, the heuristic result stands with an explanation.
// Consent switch: ?ai=off runs rules-only — no tender data leaves the machine.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = limited(_req, "heavy");
  if (gate.limited) return rateLimitedResponse(gate.retryAfter);
  const { id } = await ctx.params;
  const aiOff = new URL(_req.url).searchParams.get("ai") === "off";
  const { tender } = await getTender(id);
  if (!tender) return NextResponse.json({ error: "Tender not found." }, { status: 404 });
  if (!tender.pages || tender.pages.length === 0) {
    return NextResponse.json({ error: "No parsed pages for this tender yet. Upload and parse first." }, { status: 409 });
  }
  const { requirements, meta } = extractRequirements(tender.pages);
  const first = await saveRun(id, requirements, "heuristic/v2", meta);
  await logActivity(id, "extract", { version: first.diff.version, requirements: first.diff.requirement_count, deliverables: first.diff.deliverable_count, skipped_post_award: meta.skipped_post_award, skipped_evaluation: meta.skipped_evaluation });

  if (aiOff) {
    await logActivity(id, "extract", { mode: "rules-only (AI off by user choice)" });
    return NextResponse.json(
      { backend: first.backend, diff: first.diff, meta, ai: { ran: false, reason: "AI off by your choice — rules-only matrix, nothing sent anywhere." } },
      { status: 201 }
    );
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { backend: first.backend, diff: first.diff, meta, ai: { ran: false, reason: "Gemini API key not configured — heuristic matrix kept." } },
      { status: 201 }
    );
  }
  try {
    const ai = await aiExtractTender(id);
    const second = await saveRun(id, ai.requirements, "gemini/v1", ai.meta);
    await logActivity(id, "ai_structure", {
      version: second.diff.version,
      rows: second.diff.requirement_count,
      from: (ai.meta as { ai_structured_from?: string[] }).ai_structured_from ?? [],
    });
    return NextResponse.json({ backend: second.backend, diff: second.diff, meta: ai.meta, ai: { ran: true } }, { status: 201 });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "AI structuring failed.";
    await logActivity(id, "ai_structure_failed", { reason: reason.slice(0, 200) });
    return NextResponse.json(
      { backend: first.backend, diff: first.diff, meta, ai: { ran: false, reason: `AI structuring skipped — ${reason} Heuristic matrix kept.` } },
      { status: 201 }
    );
  }
}
