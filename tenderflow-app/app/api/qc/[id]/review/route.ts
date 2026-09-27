import { NextResponse } from "next/server";
import { logActivity } from "../../../../../lib/collab";
import { addReview } from "../../../../../lib/qc-store";

export const runtime = "nodejs";

// Human override — verdict AND reason note are both required.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { verdict?: string; note?: string; reviewer?: string; tender_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const updated = await addReview(id, body.verdict ?? "", body.note ?? "", body.reviewer ?? "bid-manager");
  if (!updated) {
    return NextResponse.json({ error: "QC result not found, or verdict/note missing." }, { status: 404 });
  }
  if (body.tender_id) {
    await logActivity(body.tender_id, "qc_review", { qc_result_id: id, verdict: body.verdict });
  }
  return NextResponse.json({ result: updated }, { status: 201 });
}
