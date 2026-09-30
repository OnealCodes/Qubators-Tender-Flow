// Better Auth database adapter over the app's local Postgres (raw pg).
// Tables: auth_user, auth_session, auth_account, auth_verification.
// Table names are whitelisted — model names never reach SQL unvalidated.
// Shape: a plain AdapterFactory (options) => DBAdapter, same contract the
// memory adapter uses — no ORM, no extra dependency.

import type { Where } from "better-auth/adapters";

const TABLES = new Set(["auth_user", "auth_session", "auth_account", "auth_verification"]);

// better-auth calls with logical model names ("user"); tables are physical.
const MODEL_TABLES: Record<string, string> = {
  user: "auth_user",
  session: "auth_session",
  account: "auth_account",
  verification: "auth_verification",
};

function tableFor(model: string): string {
  const table = MODEL_TABLES[model] ?? model;
  if (!TABLES.has(table)) throw new Error(`Unknown auth model: ${model}`);
  return table;
}

type WhereInput = Pick<Where, "field" | "value"> & {
  operator?: string;
  connector?: "AND" | "OR";
};

function escIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Bad identifier: ${name}`);
  return `"${name}"`;
}

function whereClause(where: Where[] | undefined, start: number): { sql: string; vals: unknown[] } {
  if (!where || where.length === 0) return { sql: "", vals: [] };
  const parts: string[] = [];
  const vals: unknown[] = [];
  where.forEach((wRaw, i) => {
    const w = wRaw as WhereInput;
    const col = escIdent(w.field);
    const p = `$${start + vals.length}`;
    let expr: string;
    switch (w.operator ?? "eq") {
      case "eq":
        expr = w.value === null ? `${col} IS NULL` : `${col} = ${p}`;
        if (w.value !== null) vals.push(w.value);
        break;
      case "ne":
        expr = w.value === null ? `${col} IS NOT NULL` : `${col} <> ${p}`;
        if (w.value !== null) vals.push(w.value);
        break;
      case "in":
        if (!Array.isArray(w.value) || w.value.length === 0) {
          expr = "FALSE";
          break;
        }
        expr = `${col} = ANY(${p})`;
        vals.push(w.value);
        break;
      case "gt":
        expr = `${col} > ${p}`;
        vals.push(w.value);
        break;
      case "gte":
        expr = `${col} >= ${p}`;
        vals.push(w.value);
        break;
      case "lt":
        expr = `${col} < ${p}`;
        vals.push(w.value);
        break;
      case "lte":
        expr = `${col} <= ${p}`;
        vals.push(w.value);
        break;
      default:
        throw new Error(`Unsupported auth where operator: ${w.operator}`);
    }
    parts.push(i === 0 ? expr : `${w.connector ?? "AND"} ${expr}`);
  });
  return { sql: ` WHERE ${parts.join(" ")}`, vals };
}

async function pool() {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

type JoinSpec = {
  account?: boolean;
  user?: boolean;
} & Record<string, unknown>;

// better-auth asks for relations inline (e.g. user WITH accounts on
// sign-in). The raw-pg adapter resolves them explicitly.
async function applyJoin<T extends Record<string, unknown>>(
  rows: T[],
  model: string,
  join: JoinSpec | undefined,
  run: (text: string, vals: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
): Promise<T[]> {
  if (!rows.length || !join) return rows;
  if (join.account && (model === "auth_user" || model === "user")) {
    const ids = rows.map((r) => r.id);
    const acc = await run(`SELECT * FROM auth_account WHERE "userId" = ANY($1)`, [ids]);
    const byUser = new Map<string, Record<string, unknown>[]>();
    for (const a of acc.rows) {
      const k = String(a.userId);
      if (!byUser.has(k)) byUser.set(k, []);
      byUser.get(k)!.push(a);
    }
    return rows.map((r) => ({ ...r, account: byUser.get(String(r.id)) ?? [] })) as T[];
  }
  if (join.user) {
    // Any model carrying userId (sessions, accounts) can eager-load its user.
    const ids = [...new Set(rows.map((r) => String(r.userId ?? "")).filter(Boolean))];
    if (!ids.length) return rows;
    const usr = await run(`SELECT * FROM auth_user WHERE id = ANY($1)`, [ids]);
    const byId = new Map(usr.rows.map((u) => [String(u.id), u]));
    return rows.map((r) => ({ ...r, user: byId.get(String(r.userId)) ?? null })) as T[];
  }
  return rows;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const pgAuthAdapter = (_options: unknown) => {
  // No true transactions over short-lived pools here: sequential execution
  // against this same adapter. CRITICAL: the callback must receive a working
  // adapter (self), never an empty object — better-auth runs every request
  // inside adapter.transaction().
  const self = {
    id: "tenderflow-pg",
  async create<T>({ model, data }: { model: string; data: T }): Promise<T> {
    const table = tableFor(model);
    const p = await pool();
    try {
      const row = { ...(data as Record<string, unknown>) };
      // The factory strips caller ids without always generating a
      // replacement — never let a null id reach Postgres.
      if (row.id == null) {
        const { randomUUID } = await import("node:crypto");
        row.id = randomUUID();
      }
      const cols = Object.keys(row);
      const vals = Object.values(row);
      const res = await p.query(
        `INSERT INTO ${table} (${cols.map(escIdent).join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
        vals
      );
      return res.rows[0] as T;
    } finally {
      await p.end();
    }
  },
  async findOne<T>({ model, where, join }: { model: string; where: Where[]; join?: JoinSpec }): Promise<T | null> {
    const table = tableFor(model);
    const p = await pool();
    try {
      const { sql, vals } = whereClause(where, 1);
      const res = await p.query(`SELECT * FROM ${table}${sql} LIMIT 1`, vals);
      if (!res.rows.length) return null;
      const run = async (text: string, v: unknown[]) => p.query(text, v);
      const [row] = await applyJoin(res.rows, table, join, run);
      return (row as T) ?? null;
    } finally {
      await p.end();
    }
  },
  async findMany<T>({ model, where, limit, sortBy, offset, join }: {
    model: string;
    where?: Where[];
    limit: number;
    sortBy?: { field: string; direction: "asc" | "desc" };
    offset?: number;
    join?: JoinSpec;
  }): Promise<T[]> {
    const table = tableFor(model);
    const p = await pool();
    try {
      const { sql, vals } = whereClause(where, 1);
      let q = `SELECT * FROM ${table}${sql}`;
      if (sortBy) q += ` ORDER BY ${escIdent(sortBy.field)} ${sortBy.direction === "desc" ? "DESC" : "ASC"}`;
      q += ` LIMIT ${Math.min(Math.max(limit || 100, 1), 1000)}`;
      if (offset) q += ` OFFSET ${Math.max(offset, 0)}`;
      const res = await p.query(q, vals);
      const run = async (text: string, v: unknown[]) => p.query(text, v);
      return (await applyJoin(res.rows, table, join, run)) as T[];
    } finally {
      await p.end();
    }
  },
  async count({ model, where }: { model: string; where?: Where[] }): Promise<number> {
    const table = tableFor(model);
    const p = await pool();
    try {
      const { sql, vals } = whereClause(where, 1);
      const res = await p.query(`SELECT COUNT(*)::int AS c FROM ${table}${sql}`, vals);
      return Number(res.rows[0]?.c ?? 0);
    } finally {
      await p.end();
    }
  },
  async update<T>({ model, where, update }: {
    model: string;
    where: Where[];
    update: Record<string, unknown>;
  }): Promise<T | null> {
    const table = tableFor(model);
    const entries = Object.entries(update);
    if (!entries.length) return null;
    const p = await pool();
    try {
      const sets = entries.map(([k], i) => `${escIdent(k)}=$${i + 1}`);
      const { sql, vals } = whereClause(where, entries.length + 1);
      const res = await p.query(`UPDATE ${table} SET ${sets.join(",")}${sql} RETURNING *`, [
        ...entries.map(([, v]) => v),
        ...vals,
      ]);
      return (res.rows[0] as T) ?? null;
    } finally {
      await p.end();
    }
  },
  async updateMany({ model, where, update }: {
    model: string;
    where: Where[];
    update: Record<string, unknown>;
  }): Promise<number> {
    const table = tableFor(model);
    const entries = Object.entries(update);
    const p = await pool();
    try {
      const sets = entries.map(([k], i) => `${escIdent(k)}=$${i + 1}`);
      const { sql, vals } = whereClause(where, entries.length + 1);
      const res = await p.query(
        `UPDATE ${table}${sets.length ? ` SET ${sets.join(",")}` : ""}${sql}`,
        [...entries.map(([, v]) => v), ...vals]
      );
      return res.rowCount ?? 0;
    } finally {
      await p.end();
    }
  },
  async delete({ model, where }: { model: string; where: Where[] }): Promise<void> {
    const table = tableFor(model);
    const p = await pool();
    try {
      const { sql, vals } = whereClause(where, 1);
      await p.query(`DELETE FROM ${table}${sql}`, vals);
    } finally {
      await p.end();
    }
  },
  async deleteMany({ model, where }: { model: string; where: Where[] }): Promise<number> {
    const table = tableFor(model);
    const p = await pool();
    try {
      const { sql, vals } = whereClause(where, 1);
      const res = await p.query(`DELETE FROM ${table}${sql}`, vals);
      return res.rowCount ?? 0;
    } finally {
      await p.end();
    }
  },
  async consumeOne<T>({ model, where }: { model: string; where: Where[] }): Promise<T | null> {
    const table = tableFor(model);
    const p = await pool();
    try {
      const { sql, vals } = whereClause(where, 1);
      const res = await p.query(`DELETE FROM ${table}${sql} RETURNING *`, vals);
      if (res.rows.length > 1) {
        throw new Error("consumeOne matched more than one row");
      }
      return (res.rows[0] as T) ?? null;
    } finally {
      await p.end();
    }
  },
  async incrementOne<T>({ model, where, increment, set }: {
    model: string;
    where: Where[];
    increment: Record<string, number>;
    set?: Record<string, unknown>;
  }): Promise<T | null> {
    const table = tableFor(model);
    const p = await pool();
    try {
      const inc = Object.entries(increment);
      const fixed = Object.entries(set ?? {});
      const assigns = [
        ...inc.map(([k], i) => `${escIdent(k)} = ${escIdent(k)} + $${i + 1}`),
        ...fixed.map(([k], i) => `${escIdent(k)} = $${inc.length + i + 1}`),
      ];
      const { sql, vals } = whereClause(where, inc.length + fixed.length + 1);
      const res = await p.query(`UPDATE ${table} SET ${assigns.join(",")}${sql} RETURNING *`, [
        ...inc.map(([, v]) => v),
        ...fixed.map(([, v]) => v),
        ...vals,
      ]);
      return (res.rows[0] as T) ?? null;
    } finally {
      await p.end();
    }
  },
  async transaction<R>(callback: (trx: unknown) => Promise<R>): Promise<R> {
    return callback(self);
  },
  };
  return self;
};
