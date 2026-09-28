// Tiny in-memory rate limiter — no dependencies, local stage only.
// Heavy endpoints (upload, extract, QC run-all) get a strict budget;
// everything else is effectively unlimited on localhost.

import { NextResponse } from "next/server";

const buckets = new Map<string, number[]>();

const BUDGETS: Record<string, { limit: number; windowMs: number }> = {
  heavy: { limit: 20, windowMs: 60_000 },
  default: { limit: 300, windowMs: 60_000 },
};

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function limited(req: Request, kind: keyof typeof BUDGETS = "default"): { limited: boolean; retryAfter: number } {
  const key = `${clientIp(req)}:${kind}`;
  const now = Date.now();
  const { limit, windowMs } = BUDGETS[kind];
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.ceil((hits[0] + windowMs - now) / 1000);
    return { limited: true, retryAfter: Math.max(retryAfter, 1) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { limited: false, retryAfter: 0 };
}

export function rateLimitedResponse(retryAfter: number): Response {
  const r = NextResponse.json({ error: "Too many requests — slow down and retry." }, { status: 429 });
  r.headers.set("Retry-After", String(retryAfter));
  return r;
}
