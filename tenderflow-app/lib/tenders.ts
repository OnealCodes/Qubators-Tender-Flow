// Tender persistence — Postgres when reachable, local JSON otherwise.
// Phase 3 contract: the app works today via uploads/db.json; the moment
// `docker compose up -d db` runs, the same code uses PostgreSQL with the
// identical record shape (see db/001-init.sql). No caller changes needed.

import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import type { TenderOverview } from "./overview";
import type { ParsedPage } from "./pdf";

export interface TenderRecord {
  id: string;
  company_id: string;
  client: string | null;
  title: string;
  reference: string | null;
  scope: string | null;
  submission_deadline: string | null;
  clarification_deadline: string | null;
  clarification_meeting: string | null;
  submission_format: string | null;
  instructions: string | null;
  bucket_counts: Record<string, number>;
  file_name: string;
  file_size: number;
  file_hash: string | null;
  page_count: number;
  scanned: boolean;
  status: string;
  created_at: string;
  pages?: ParsedPage[];
}

const COMPANY_ID = "demo-company";
const MAX_BYTES = 200 * 1024 * 1024;

export function uploadsDir(): string {
  const dir = process.env.UPLOADS_DIR
    ? path.resolve(process.cwd(), process.env.UPLOADS_DIR)
    : path.join(process.cwd(), "uploads");
  return dir;
}

export function validateUpload(fileName: string, size: number): string | null {
  if (!/\.pdf$/i.test(fileName)) return "Only PDF files are accepted in this phase.";
  if (size <= 0) return "Empty file.";
  if (size > MAX_BYTES) return "File exceeds the 200 MB limit.";
  return null;
}

export function sha256Hex(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

// Same file uploaded twice returns the existing tender instead of a duplicate.
export async function findByHash(hash: string): Promise<TenderRecord | null> {
  if (await postgresReachable()) {
    try {
      const pool = await pgPool();
      try {
        const res = await pool.query("SELECT * FROM tenders WHERE company_id=$1 AND file_hash=$2 ORDER BY created_at DESC LIMIT 1", [COMPANY_ID, hash]);
        if (res.rows.length) return rowToRecord(res.rows[0]);
      } finally {
        await pool.end();
      }
    } catch { /* fall through */ }
  }
  const all = await readAll();
  return all.find((t) => t.file_hash === hash) ?? null;
}

// ---------- local JSON store (works with zero setup) ----------

async function dbFile(): Promise<string> {
  const dir = uploadsDir();
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, "db.json");
}

async function readAll(): Promise<TenderRecord[]> {
  try {
    const raw = await fs.readFile(await dbFile(), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.tenders) ? data.tenders : [];
  } catch {
    return [];
  }
}

async function writeAll(tenders: TenderRecord[]): Promise<void> {
  await fs.writeFile(await dbFile(), JSON.stringify({ tenders }, null, 2), "utf8");
}

export async function saveTenderLocal(rec: TenderRecord, pages: ParsedPage[]): Promise<void> {
  const dir = path.join(uploadsDir(), rec.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "pages.json"), JSON.stringify(pages), "utf8");
  const all = await readAll();
  const i = all.findIndex((t) => t.id === rec.id);
  const stored = { ...rec };
  delete stored.pages;
  if (i >= 0) all[i] = stored;
  else all.unshift(stored);
  await writeAll(all);
}

export async function listTendersLocal(): Promise<TenderRecord[]> {
  return readAll();
}

export async function getTenderLocal(id: string): Promise<TenderRecord | null> {
  const all = await readAll();
  const rec = all.find((t) => t.id === id) ?? null;
  if (!rec) return null;
  try {
    const raw = await fs.readFile(path.join(uploadsDir(), id, "pages.json"), "utf8");
    return { ...rec, pages: JSON.parse(raw) };
  } catch {
    return rec;
  }
}

// ---------- Postgres store (used automatically when reachable) ----------

async function pgPool() {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

export async function postgresReachable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const pool = await pgPool();
    try {
      await pool.query("SELECT 1");
      return true;
    } finally {
      await pool.end();
    }
  } catch {
    return false;
  }
}

export async function saveTenderPostgres(rec: TenderRecord, pages: ParsedPage[]): Promise<void> {
  const pool = await pgPool();
  try {
    await pool.query(
      `INSERT INTO tenders (id, company_id, client, title, reference, scope,
        submission_deadline, clarification_deadline, clarification_meeting,
        submission_format, instructions, bucket_counts, file_name, file_size,
        file_hash, page_count, scanned, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, status=EXCLUDED.status`,
      [rec.id, COMPANY_ID, rec.client, rec.title, rec.reference, rec.scope,
       rec.submission_deadline, rec.clarification_deadline, rec.clarification_meeting,
       rec.submission_format, rec.instructions, JSON.stringify(rec.bucket_counts),
       rec.file_name, rec.file_size, rec.file_hash, rec.page_count, rec.scanned, rec.status]
    );
    for (const p of pages) {
      await pool.query(
        `INSERT INTO tender_pages (tender_id, page_no, text, char_count)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (tender_id, page_no) DO UPDATE SET text=EXCLUDED.text, char_count=EXCLUDED.char_count`,
        [rec.id, p.page_no, p.text, p.char_count]
      );
    }
  } finally {
    await pool.end();
  }
}

function rowToRecord(row: Record<string, unknown>): TenderRecord {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    client: (row.client as string) ?? null,
    title: String(row.title ?? ""),
    reference: (row.reference as string) ?? null,
    scope: (row.scope as string) ?? null,
    submission_deadline: (row.submission_deadline as string) ?? null,
    clarification_deadline: (row.clarification_deadline as string) ?? null,
    clarification_meeting: (row.clarification_meeting as string) ?? null,
    submission_format: (row.submission_format as string) ?? null,
    instructions: (row.instructions as string) ?? null,
    bucket_counts: (row.bucket_counts as Record<string, number>) ?? {},
    file_name: String(row.file_name ?? ""),
    file_size: Number(row.file_size ?? 0),
    file_hash: (row.file_hash as string) ?? null,
    page_count: Number(row.page_count ?? 0),
    scanned: Boolean(row.scanned),
    status: String(row.status ?? "intake"),
    created_at: String(row.created_at ?? ""),
  };
}

export async function listTendersPostgres(): Promise<TenderRecord[]> {
  const pool = await pgPool();
  try {
    const res = await pool.query("SELECT * FROM tenders WHERE company_id=$1 ORDER BY created_at DESC", [COMPANY_ID]);
    return res.rows.map(rowToRecord);
  } finally {
    await pool.end();
  }
}

export async function getTenderPostgres(id: string): Promise<TenderRecord | null> {
  const pool = await pgPool();
  try {
    const res = await pool.query("SELECT * FROM tenders WHERE id=$1 AND company_id=$2", [id, COMPANY_ID]);
    if (res.rows.length === 0) return null;
    const pages = await pool.query("SELECT page_no, text, char_count FROM tender_pages WHERE tender_id=$1 ORDER BY page_no", [id]);
    return { ...rowToRecord(res.rows[0]), pages: pages.rows };
  } finally {
    await pool.end();
  }
}

// ---------- facade: Postgres first, local fallback ----------

export async function backend(): Promise<"postgres" | "local"> {
  return (await postgresReachable()) ? "postgres" : "local";
}

export async function saveTender(rec: TenderRecord, pages: ParsedPage[]): Promise<"postgres" | "local"> {
  await saveTenderLocal(rec, pages); // originals + derived text always stay on disk
  if (await postgresReachable()) {
    try {
      await saveTenderPostgres(rec, pages);
      return "postgres";
    } catch {
      return "local";
    }
  }
  return "local";
}

export async function listTenders(): Promise<{ tenders: TenderRecord[]; backend: "postgres" | "local" }> {
  if (await postgresReachable()) {
    try {
      return { tenders: await listTendersPostgres(), backend: "postgres" };
    } catch {
      // fall through to local
    }
  }
  return { tenders: await listTendersLocal(), backend: "local" };
}

export async function getTender(id: string): Promise<{ tender: TenderRecord | null; backend: "postgres" | "local" }> {
  if (await postgresReachable()) {
    try {
      return { tender: await getTenderPostgres(id), backend: "postgres" };
    } catch {
      // fall through to local
    }
  }
  return { tender: await getTenderLocal(id), backend: "local" };
}

export function buildRecord(
  id: string,
  fileName: string,
  fileSize: number,
  overview: TenderOverview,
  page_count: number,
  scanned: boolean,
  fileHash: string | null = null
): TenderRecord {
  const v = (f: { value: string | null }) => f.value;
  return {
    id,
    company_id: COMPANY_ID,
    client: v(overview.client),
    title: overview.title.value ?? fileName,
    reference: v(overview.reference),
    scope: v(overview.scope),
    submission_deadline: v(overview.submission_deadline),
    clarification_deadline: v(overview.clarification_deadline),
    clarification_meeting: v(overview.clarification_meeting),
    submission_format: v(overview.submission_format),
    instructions: v(overview.instructions),
    bucket_counts: overview.bucket_counts,
    file_name: fileName,
    file_size: fileSize,
    file_hash: fileHash,
    page_count,
    scanned,
    status: "intake",
    created_at: new Date().toISOString(),
  };
}
