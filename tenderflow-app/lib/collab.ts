// Phase 5 collaboration store — assign, evidence, comments, activity, reminders.
// Postgres when reachable, local JSON mirror otherwise (same shape).

import fs from "node:fs/promises";
import path from "node:path";
import { postgresReachable, uploadsDir } from "./tenders";

export interface Evidence {
  id: string;
  deliverable_id: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

// Absolute disk paths must never leave the server: API responses expose a
// path relative to the uploads directory instead.
export function publicEvidence(e: Evidence): Omit<Evidence, "storage_path"> & { file: string } {
  const { storage_path, ...rest } = e;
  const rel = path.relative(uploadsDir(), storage_path).replace(/\\/g, "/");
  return { ...rest, file: rel };
}

export interface Comment {
  id: string;
  deliverable_id: string;
  author: string;
  kind: string;
  body: string;
  resolved: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  tender_id: string;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

function rid(p: string): string {
  return `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const ACTOR = "bid-manager";

// ---------- local JSON mirror ----------

interface LocalDoc { evidence: Evidence[]; comments: Comment[]; activities: Activity[]; }

async function docFile(): Promise<string> {
  await fs.mkdir(uploadsDir(), { recursive: true });
  return path.join(uploadsDir(), "collab.json");
}

async function readDoc(): Promise<LocalDoc> {
  try {
    const raw = await fs.readFile(await docFile(), "utf8");
    const d = JSON.parse(raw);
    return { evidence: d.evidence ?? [], comments: d.comments ?? [], activities: d.activities ?? [] };
  } catch {
    return { evidence: [], comments: [], activities: [] };
  }
}

async function writeDoc(doc: LocalDoc): Promise<void> {
  await fs.writeFile(await docFile(), JSON.stringify(doc, null, 2), "utf8");
}

// ---------- Postgres ----------

async function pool() {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

function toEvidence(r: Record<string, unknown>): Evidence {
  return {
    id: String(r.id), deliverable_id: String(r.deliverable_id), file_name: String(r.file_name ?? ""),
    file_size: Number(r.file_size ?? 0), storage_path: String(r.storage_path ?? ""),
    uploaded_by: String(r.uploaded_by ?? ACTOR), created_at: String(r.created_at ?? ""),
  };
}

function toComment(r: Record<string, unknown>): Comment {
  return {
    id: String(r.id), deliverable_id: String(r.deliverable_id), author: String(r.author ?? ACTOR),
    kind: String(r.kind ?? "comment"), body: String(r.body ?? ""), resolved: Boolean(r.resolved),
    created_at: String(r.created_at ?? ""),
  };
}

function toActivity(r: Record<string, unknown>): Activity {
  return {
    id: String(r.id), tender_id: String(r.tender_id), actor: String(r.actor ?? ACTOR),
    action: String(r.action ?? ""), payload: (r.payload as Record<string, unknown>) ?? {},
    created_at: String(r.created_at ?? ""),
  };
}

// ---------- activity (dual-write: best effort on both) ----------

export async function logActivity(tenderId: string, action: string, payload: Record<string, unknown> = {}, actor = ACTOR): Promise<void> {
  const entry: Activity = { id: rid("a"), tender_id: tenderId, actor, action, payload, created_at: new Date().toISOString() };
  try {
    const doc = await readDoc();
    doc.activities.unshift(entry);
    await writeDoc(doc);
  } catch { /* local write failed; continue */ }
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        await p.query("INSERT INTO activities (id,tender_id,actor,action,payload) VALUES ($1,$2,$3,$4,$5)",
          [entry.id, tenderId, actor, action, JSON.stringify(payload)]);
      } finally {
        await p.end();
      }
    } catch { /* postgres write failed; local copy kept */ }
  }
}

export async function listActivity(tenderId: string, limit = 100): Promise<Activity[]> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT * FROM activities WHERE tender_id=$1 ORDER BY created_at DESC LIMIT $2", [tenderId, limit]);
        if (r.rows.length) return r.rows.map(toActivity);
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  return doc.activities.filter((a) => a.tender_id === tenderId).slice(0, limit);
}

// ---------- evidence ----------

export async function addEvidence(deliverableId: string, fileName: string, fileSize: number, storagePath: string, uploadedBy = ACTOR): Promise<Evidence> {
  const entry: Evidence = { id: rid("e"), deliverable_id: deliverableId, file_name: fileName, file_size: fileSize, storage_path: storagePath, uploaded_by: uploadedBy, created_at: new Date().toISOString() };
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        await p.query("INSERT INTO evidence (id,deliverable_id,file_name,file_size,storage_path,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6)",
          [entry.id, deliverableId, fileName, fileSize, storagePath, uploadedBy]);
        await p.query("UPDATE deliverables SET status='received' WHERE id=$1 AND status='outstanding'", [deliverableId]);
        return entry;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  doc.evidence.unshift(entry);
  await writeDoc(doc);
  return entry;
}

export async function listEvidence(deliverableId: string): Promise<Evidence[]> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT * FROM evidence WHERE deliverable_id=$1 ORDER BY created_at DESC", [deliverableId]);
        if (r.rows.length) return r.rows.map(toEvidence);
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  return doc.evidence.filter((e) => e.deliverable_id === deliverableId);
}

// ---------- comments (comment | issue | clarification_request) ----------

const KINDS = ["comment", "issue", "clarification_request"];

export async function addComment(deliverableId: string, body: string, kind = "comment", author = ACTOR): Promise<Comment | null> {
  if (!body.trim() || !KINDS.includes(kind)) return null;
  const entry: Comment = { id: rid("c"), deliverable_id: deliverableId, author, kind, body: body.trim(), resolved: false, created_at: new Date().toISOString() };
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        await p.query("INSERT INTO comments (id,deliverable_id,author,kind,body) VALUES ($1,$2,$3,$4,$5)",
          [entry.id, deliverableId, author, kind, entry.body]);
        return entry;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  doc.comments.unshift(entry);
  await writeDoc(doc);
  return entry;
}

export async function listComments(deliverableId: string): Promise<Comment[]> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT * FROM comments WHERE deliverable_id=$1 ORDER BY created_at", [deliverableId]);
        if (r.rows.length) return r.rows.map(toComment);
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  return doc.comments.filter((c) => c.deliverable_id === deliverableId);
}

// ---------- reminders: overdue + due-soon from deliverable due dates ----------

export interface ReminderItem {
  deliverable_id: string;
  requirement_id: string;
  title: string;
  owner: string;
  due_date: string;
  status: string;
  overdue: boolean;
}

export function computeReminders(
  deliverables: { id: string; requirement_id: string; title: string; owner: string | null; due_date: string | null; status: string }[],
  now = new Date()
): { overdue: ReminderItem[]; dueSoon: ReminderItem[] } {
  const today = now.toISOString().slice(0, 10);
  const soon = new Date(now.getTime() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const overdue: ReminderItem[] = [];
  const dueSoon: ReminderItem[] = [];
  for (const d of deliverables) {
    if (!d.due_date || /received|complete/i.test(d.status)) continue;
    const item: ReminderItem = {
      deliverable_id: d.id, requirement_id: d.requirement_id, title: d.title,
      owner: d.owner ?? "Unassigned", due_date: d.due_date, status: d.status,
      overdue: d.due_date < today,
    };
    if (d.due_date < today) overdue.push(item);
    else if (d.due_date <= soon) dueSoon.push({ ...item, overdue: false });
  }
  overdue.sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  return { overdue, dueSoon };
}
