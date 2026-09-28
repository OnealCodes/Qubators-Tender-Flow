import { NextResponse } from "next/server";
import { logActivity } from "../../../../../lib/collab";
import { limited, rateLimitedResponse } from "../../../../../lib/rate-limit";
import { extractRequirements } from "../../../../../lib/extract";
import { getActive, saveRun } from "../../../../../lib/requirements";
import { getTender } from "../../../../../lib/tenders";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { requirements, deliverables, backend } = await getActive(id);
  return NextResponse.json({ backend, requirements, deliverables });
}

// Re-run extraction: new version, diff, human edits win.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = limited(_req, "heavy");
  if (gate.limited) return rateLimitedResponse(gate.retryAfter);
  const { id } = await ctx.params;
  const { tender } = await getTender(id);
  if (!tender) return NextResponse.json({ error: "Tender not found." }, { status: 404 });
  if (!tender.pages || tender.pages.length === 0) {
    return NextResponse.json({ error: "No parsed pages for this tender yet. Upload and parse first." }, { status: 409 });
  }
  const { requirements, meta } = extractRequirements(tender.pages);
  const { diff, backend } = await saveRun(id, requirements, "heuristic/v2", meta);
  await logActivity(id, "extract", { version: diff.version, requirements: diff.requirement_count, deliverables: diff.deliverable_count, skipped_post_award: meta.skipped_post_award, skipped_evaluation: meta.skipped_evaluation });
  return NextResponse.json({ backend, diff, meta }, { status: 201 });
}
