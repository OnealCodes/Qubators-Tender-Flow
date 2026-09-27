import { NextResponse } from "next/server";
import { listDocs } from "../../../../../lib/library";
import { expiryBadge } from "../../../../../lib/matching";
import { getTender } from "../../../../../lib/tenders";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [docs, tenderRes] = await Promise.all([listDocs(), getTender(id)]);
  const submission = tenderRes.tender?.submission_deadline ?? null;
  const rows = docs.map((d) => ({ ...d, expiry: expiryBadge(d.expiry_date, submission) }));
  const counts = {
    red: rows.filter((r) => r.expiry.level === "red").length,
    amber: rows.filter((r) => r.expiry.level === "amber").length,
    green: rows.filter((r) => r.expiry.level === "green").length,
  };
  return NextResponse.json({ submission_deadline: submission, docs: rows, counts });
}
