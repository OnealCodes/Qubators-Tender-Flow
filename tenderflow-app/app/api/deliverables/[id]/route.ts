import { NextResponse } from "next/server";
import { listComments, listEvidence, logActivity } from "../../../../lib/collab";
import { updateDeliverable } from "../../../../lib/requirements";

export const runtime = "nodejs";

async function findTenderId(deliverableId: string): Promise<string | null> {
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = await import("pg");
      const p = new Pool({ connectionString: process.env.DATABASE_URL });
      try {
        const r = await p.query("SELECT tender_id FROM requirements WHERE id=(SELECT requirement_id FROM deliverables WHERE id=$1)", [deliverableId]);
        return r.rows.length ? String(r.rows[0].tender_id) : null;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [evidence, comments] = await Promise.all([listEvidence(id), listComments(id)]);
  return NextResponse.json({ evidence, comments });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let patch: Record<string, unknown>;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const before = await findTenderId(id);
  const updated = await updateDeliverable(id, patch);
  if (!updated) return NextResponse.json({ error: "Deliverable not found or nothing to update." }, { status: 404 });
  const tenderId = before ?? updated.tender_id;
  if (patch.status && tenderId) {
    await logActivity(tenderId, "status", { deliverable_id: id, to: patch.status });
  }
  return NextResponse.json({ deliverable: updated.deliv });
}
