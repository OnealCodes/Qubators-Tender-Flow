import { NextResponse } from "next/server";
import { limited, rateLimitedResponse } from "../../../../../lib/rate-limit";
import { runQcForDeliverable, tenderQc } from "../../../../../lib/qc-store";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { rows, counts, backend } = await tenderQc(id);
  return NextResponse.json({ backend, rows, counts });
}

// Run QC across every deliverable of the tender (uses each item's latest
// evidence or accepted library match; items without sources stay not_reviewed).
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = limited(_req, "heavy");
  if (gate.limited) return rateLimitedResponse(gate.retryAfter);
  const { id } = await ctx.params;
  const before = await tenderQc(id);
  let backend: "postgres" | "local" = before.backend;
  let ran = 0;
  for (const row of before.rows) {
    const r = await runQcForDeliverable(id, row.deliverable_id);
    backend = r.backend;
    ran++;
  }
  const after = await tenderQc(id);
  return NextResponse.json({ backend, ran, counts: after.counts }, { status: 201 });
}
