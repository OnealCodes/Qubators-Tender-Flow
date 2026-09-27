import { NextResponse } from "next/server";
import { computeReminders } from "../../../../../lib/collab";
import { getActive } from "../../../../../lib/requirements";

export const runtime = "nodejs";

// In-app reminders: overdue + due within 3 days, grouped for the Bid Manager.
// Email digest comes later (no paid service in this phase).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { deliverables } = await getActive(id);
  const { overdue, dueSoon } = computeReminders(deliverables);
  const byOwner: Record<string, number> = {};
  for (const o of overdue) byOwner[o.owner] = (byOwner[o.owner] ?? 0) + 1;
  return NextResponse.json({ overdue, dueSoon, overdueByOwner: byOwner });
}
