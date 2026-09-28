import { NextResponse } from "next/server";
import { listActivity } from "../../../../../../lib/collab";

export const runtime = "nodejs";

// Downloadable audit trail (JSON) for the pilot file.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const activities = await listActivity(id, 1000);
  const body = JSON.stringify({ tender_id: id, exported_at: new Date().toISOString(), activities }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="audit-${id}.json"`,
    },
  });
}
