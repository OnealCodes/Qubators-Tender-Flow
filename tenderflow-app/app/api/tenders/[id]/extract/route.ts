import { NextResponse } from "next/server";
import { logActivity } from "../../../../../lib/collab";
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
  const { id } = await ctx.params;
  const { tender } = await getTender(id);
  if (!tender) return NextResponse.json({ error: "Tender not found." }, { status: 404 });
  if (!tender.pages || tender.pages.length === 0) {
    return NextResponse.json({ error: "No parsed pages for this tender yet. Upload and parse first." }, { status: 409 });
  }
  const extracted = extractRequirements(tender.pages);
  const { diff, backend } = await saveRun(id, extracted);
  await logActivity(id, "extract", { version: diff.version, requirements: diff.requirement_count, deliverables: diff.deliverable_count });
  return NextResponse.json({ backend, diff }, { status: 201 });
}
