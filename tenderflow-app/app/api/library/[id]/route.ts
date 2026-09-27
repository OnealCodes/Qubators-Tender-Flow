import { NextResponse } from "next/server";
import { deleteDoc, updateDoc } from "../../../../lib/library";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let patch: Record<string, unknown>;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const updated = await updateDoc(id, patch);
  if (!updated) return NextResponse.json({ error: "Document not found or nothing to update." }, { status: 404 });
  return NextResponse.json({ doc: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await deleteDoc(id);
  if (!ok) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
