import { NextResponse } from "next/server";
import { historyFor, runQcForDeliverable } from "../../../../../lib/qc-store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ history: await historyFor(id) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { tender_id?: string } = {};
  try {
    body = await req.json();
  } catch { /* tender_id optional in URL-less calls */ }
  // tender_id may also come as a query param
  if (!body.tender_id) {
    body.tender_id = new URL(req.url).searchParams.get("tender_id") ?? undefined;
  }
  if (!body.tender_id) {
    return NextResponse.json({ error: "tender_id is required." }, { status: 400 });
  }
  try {
    const { record, backend } = await runQcForDeliverable(body.tender_id, id);
    return NextResponse.json({ backend, result: record }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "QC run failed." }, { status: 404 });
  }
}
