import { NextResponse } from "next/server";
import { sessionUser } from "../../../lib/authz";

export const runtime = "nodejs";

async function pool() {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

export async function GET(req: Request) {
  const user = await sessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const p = await pool();
  try {
    const r = await p.query(
      'SELECT id, name, email, role, company_id, "createdAt" AS created_at FROM auth_user WHERE company_id=$1 ORDER BY "createdAt"',
      [user.company_id]
    );
    return NextResponse.json({ users: r.rows, you: user.id, yourRole: user.role });
  } finally {
    await p.end();
  }
}

