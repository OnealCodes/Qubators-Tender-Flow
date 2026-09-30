import { NextResponse } from "next/server";
import { MANAGER } from "../../../../lib/auth";
import { managerOnly, sessionUser } from "../../../../lib/authz";

export const runtime = "nodejs";

async function pool() {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await sessionUser(req);
  const denied = managerOnly(user);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: { role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (body.role !== MANAGER && body.role !== "contributor") {
    return NextResponse.json({ error: "role must be manager or contributor." }, { status: 400 });
  }
  if (id === user!.id && body.role !== MANAGER) {
    return NextResponse.json({ error: "You cannot demote yourself." }, { status: 400 });
  }
  const p = await pool();
  try {
    if (body.role !== MANAGER) {
      const managers = await p.query("SELECT COUNT(*)::int AS c FROM auth_user WHERE company_id=$1 AND role=$2 AND id<>$3", [
        user!.company_id,
        MANAGER,
        id,
      ]);
      if (Number(managers.rows[0]?.c ?? 0) === 0) {
        return NextResponse.json({ error: "Every company needs at least one Bid Manager." }, { status: 400 });
      }
    }
    const r = await p.query('UPDATE auth_user SET role=$1, "updatedAt"=now() WHERE id=$2 AND company_id=$3 RETURNING id, role', [
      body.role,
      id,
      user!.company_id,
    ]);
    if (!r.rows.length) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ user: r.rows[0] });
  } finally {
    await p.end();
  }
}

