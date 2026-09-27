import { NextResponse } from "next/server";
import { getTender } from "../../../../lib/tenders";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { tender, backend } = await getTender(id);
  if (!tender) {
    return NextResponse.json({ error: "Tender not found." }, { status: 404 });
  }
  return NextResponse.json({ backend, tender });
}
