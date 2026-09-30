import { describe, expect, it } from "vitest";

// Auth smoke test: real signup + sign-in against the local Postgres.
// Uses unique throwaway accounts and deletes only those afterwards.

process.env.DATABASE_URL = "postgresql://tenderflow:tenderflow@127.0.0.1:5432/tenderflow";
process.env.BETTER_AUTH_SECRET = "test-secret-for-debug-only-0123456789";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

describe("auth flow", () => {
  it("signs up and signs in", async () => {
    const { auth } = await import("../auth");
    const email = `smoke${Date.now()}@test.local`;
    const signed = await auth.api.signUpEmail({
      body: { name: "Smoke", email, password: "TestPass123" },
    });
    const role = (signed as { user?: { role?: string } })?.user?.role;
    expect(["manager", "contributor"]).toContain(role);
    const session = await auth.api.signInEmail({ body: { email, password: "TestPass123" } });
    expect((session as { token?: string })?.token).toBeTruthy();
    const { Pool } = await import("pg");
    const p = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await p.query("DELETE FROM auth_user WHERE email=$1", [email]);
    } finally {
      await p.end();
    }
  }, 120000);
});
