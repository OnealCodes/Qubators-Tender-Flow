import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { pgAuthAdapter } from "./auth-pg";

export const MANAGER = "manager";
export const CONTRIBUTOR = "contributor";
export const COMPANY_ID = "demo-company";

async function userCount(): Promise<number> {
  const { Pool } = await import("pg");
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await p.query("SELECT COUNT(*)::int AS c FROM auth_user");
    return Number(r.rows[0]?.c ?? 0);
  } finally {
    await p.end();
  }
}

export const auth = betterAuth({
  database: pgAuthAdapter,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  user: {
    modelName: "auth_user",
    additionalFields: {
      role: { type: "string", required: false, defaultValue: CONTRIBUTOR, input: false },
      company_id: { type: "string", required: false, defaultValue: COMPANY_ID, input: false },
    },
  },
  session: {
    modelName: "auth_session",
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  account: { modelName: "auth_account" },
  verification: { modelName: "auth_verification" },
  databaseHooks: {
    user: {
      create: {
        // First account on a fresh install becomes the Bid Manager.
        // Everyone after that starts as Contributor until promoted.
        async before(user) {
          try {
            const n = await userCount();
            if (n === 0) {
              return { data: { ...user, role: MANAGER, company_id: COMPANY_ID } };
            }
          } catch { /* fall through with defaults */ }
          return { data: { ...user, role: CONTRIBUTOR, company_id: COMPANY_ID } };
        },
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  plugins: [nextCookies()],
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  company_id: string;
};
