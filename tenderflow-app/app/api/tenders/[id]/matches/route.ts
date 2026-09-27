import { NextResponse } from "next/server";
import { linksFor, listDocs, upsertLink } from "../../../../../lib/library";
import { expiryBadge, matchDeliverable } from "../../../../../lib/matching";
import { getActive } from "../../../../../lib/requirements";
import { getTender } from "../../../../../lib/tenders";

export const runtime = "nodejs";

// Candidates per deliverable. Proposed links are stored (idempotent) so
// Accept/Reject acts on a row; nothing is ever auto-approved.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [{ requirements, deliverables }, docs, tenderRes] = await Promise.all([
    getActive(id),
    listDocs(),
    getTender(id),
  ]);
  const submission = tenderRes.tender?.submission_deadline ?? null;
  const links = await linksFor(deliverables.map((d) => d.id));
  const linkByPair = new Map(links.map((l) => [`${l.deliverable_id}:${l.library_doc_id}`, l]));

  const matches = [];
  for (const d of deliverables) {
    const accepted = links.find((l) => l.deliverable_id === d.id && l.status === "accepted");
    if (accepted) continue; // already resolved with an accepted doc
    const cands = [];
    for (const c of matchDeliverable(d.title, d.expected_detail, docs)) {
      const stored = await upsertLink(d.id, c.library_doc_id, c.confidence, c.reasons.join("; "));
      const current = linkByPair.get(`${d.id}:${c.library_doc_id}`);
      const status = current?.status ?? stored.status;
      if (status === "rejected") continue;
      const doc = docs.find((x) => x.id === c.library_doc_id);
      cands.push({ ...c, status, expiry_badge: expiryBadge(doc?.expiry_date ?? null, submission) });
    }
    if (cands.length) matches.push({ deliverable_id: d.id, title: d.title, owner: d.owner, candidates: cands });
  }
  return NextResponse.json({ matches, requirement_count: requirements.length });
}
