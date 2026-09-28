import { NextResponse } from "next/server";
import { tenderQc } from "../../../../../lib/qc-store";
import { getTender, listTenders } from "../../../../../lib/tenders";

export const runtime = "nodejs";

// Local funnel metrics from the audit trail + QC state. AI spend is tracked
// as zero: no model calls exist yet (heuristic engines only).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (id === "all") {
    const { tenders } = await listTenders();
    return NextResponse.json({
      tenders: tenders.length,
      ai_spend_usd: 0,
      note: "Per-tender funnel available at /api/tenders/[id]/metrics.",
    });
  }
  const [{ rows, counts }, tenderRes] = await Promise.all([
    tenderQc(id),
    getTender(id),
  ]);
  if (!tenderRes.tender) return NextResponse.json({ error: "Tender not found." }, { status: 404 });
  const funnel = {
    uploaded: 1,
    requirements: rows.length,
    with_source: rows.filter((r) => r.latest && r.latest.source_kind !== "none").length,
    compliant: counts.compliant ?? 0,
    review: counts.review ?? 0,
    non_compliant: counts.non_compliant ?? 0,
    not_reviewed: counts.not_reviewed ?? 0,
  };
  return NextResponse.json({ tender_id: id, funnel, ai_spend_usd: 0 });
}
