import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "better-auth.session_token";

const PUBLIC = [
  "/",
  "/sign-in",
  "/sign-up",
  "/api/auth",
  "/favicon.ico",
];

// Edge-safe gate: session cookie presence. Full validity is checked
// server-side (Shell session + sensitive API endpoints). JWT verification
// before any networked deployment.
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC.some((p) => path === p || path.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (path.startsWith("/_next") || path.includes(".")) {
    return NextResponse.next();
  }
  const hasSession = (req.cookies.get(SESSION_COOKIE)?.value ?? "").length > 0;
  if (!hasSession) {
    // API clients get machine-readable 401s, browsers get the sign-in page.
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
