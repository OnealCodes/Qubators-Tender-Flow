import { NextResponse } from "next/server";
import { logActivity } from "../../../../../lib/collab";
import { assignRequirement, getRequirement } from "../../../../../lib/requirements";

export const runtime = "nodejs";

// Accept/Change a suggested owner. Body: { owner, due_date? }.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { owner?: string; due_date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const before = await getRequirement(id);
  if (!before) return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
  if (!body.owner?.trim()) return NextResponse.json({ error: "Owner is required." }, { status: 400 });

  const updated = await assignRequirement(id, body.owner, body.due_date ?? null);
  await logActivity(before.tender_id, "assign", { requirement_id: id, from: before.owner, to: body.owner.trim(), due_date: body.due_date ?? null });
  return NextResponse.json({ requirement: updated });
}
