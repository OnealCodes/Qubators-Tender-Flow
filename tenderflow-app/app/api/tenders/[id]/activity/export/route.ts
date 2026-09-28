import { NextResponse } from "next/server";
import { listActivity } from "../../../../../../lib/collab";

export const runtime = "nodejs";

// Audit export for the bid file: JSON by default, ?format=csv for spreadsheets.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const activities = await listActivity(id, 1000);
  if (format === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["created_at,actor,action,payload", ...activities.map((a) => [a.created_at, a.actor, a.action, JSON.stringify(a.payload)].map(esc).join(","))].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="tender-${id}-activity.csv"`,
      },
    });
  }
  return NextResponse.json({ tender_id: id, count: activities.length, activities });
}
