import { NextResponse } from "next/server";
import { auth, MANAGER, type SessionUser } from "./auth";

// Server-side session check for API routes. Returns the user or null.
// Pilot scope: enforced on sensitive endpoints (delete, roles); read and
// workspace-write endpoints stay open on localhost until JWT verification
// lands (tracked for any networked deployment).
export async function sessionUser(req: Request): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const u = session?.user as unknown as Record<string, unknown> | undefined;
    if (!session || !u || typeof u.id !== "string") return null;
    return {
      id: u.id,
      name: String(u.name ?? ""),
      email: String(u.email ?? ""),
      role: String((u as Record<string, unknown>).role ?? "contributor"),
      company_id: String((u as Record<string, unknown>).company_id ?? "demo-company"),
    };
  } catch {
    return null;
  }
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Sign in required." }, { status: 401 });
}

export function managerOnly(user: SessionUser | null): NextResponse | null {
  if (!user) return forbidden();
  if (user.role !== MANAGER) {
    return NextResponse.json({ error: "Bid Manager role required." }, { status: 403 });
  }
  return null;
}
