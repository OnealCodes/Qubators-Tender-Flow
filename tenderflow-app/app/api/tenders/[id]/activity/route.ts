import { NextResponse } from "next/server";
import { listActivity } from "../../../../../lib/collab";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ activities: await listActivity(id) });
}
