import { NextResponse } from "next/server";
import { computeReadiness, finalReview, type ReadinessItem } from "../../../../../lib/readiness";
import { tenderQc } from "../../../../../lib/qc-store";
import { getActive } from "../../../../../lib/requirements";
import { getTender } from "../../../../../lib/tenders";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [{ requirements, deliverables }, qc, tenderRes] = await Promise.all([
    getActive(id),
    tenderQc(id),
    getTender(id),
  ]);
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const verdictByDeliv = new Map(qc.rows.map((r) => [r.deliverable_id, r.latest?.effective ?? "not_reviewed"]));
  const items: ReadinessItem[] = deliverables.map((d) => {
    const r = reqById.get(d.requirement_id);
    return {
      deliverable_id: d.id,
      requirement_id: d.requirement_id,
      title: d.title,
      owner: d.owner,
      risk: r?.risk ?? "mandatory",
      type: "deliverable",
      status: d.status,
      verdict: verdictByDeliv.get(d.id) ?? "not_reviewed",
      section: r?.section ?? "General",
      req_type: r?.type ?? null,
    };
  });
  const readiness = computeReadiness(items);
  const review = finalReview(items);
  const submission = tenderRes.tender?.submission_deadline ?? null;
  return NextResponse.json({
    backend: qc.backend,
    readiness,
    final: review,
    submission_deadline: submission,
    title: tenderRes.tender?.title ?? null,
  });
}
