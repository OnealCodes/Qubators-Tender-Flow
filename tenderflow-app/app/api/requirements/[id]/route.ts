import { NextResponse } from "next/server";
import { updateRequirement } from "../../../../lib/requirements";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let patch: Record<string, unknown>;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const updated = await updateRequirement(id, patch);
  if (!updated) return NextResponse.json({ error: "Requirement not found or nothing to update." }, { status: 404 });
  return NextResponse.json({ requirement: updated });
}
