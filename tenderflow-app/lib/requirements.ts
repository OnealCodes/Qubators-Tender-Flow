// Requirements store — versioned extraction with human-edits-win.
// Postgres when reachable, local JSON mirror otherwise (same merge logic).

import fs from "node:fs/promises";
import path from "node:path";
import type { ExtractedRequirement } from "./extract";
import { postgresReachable, uploadsDir } from "./tenders";

export interface Requirement {
  id: string;
  tender_id: string;
  run_version: number;
  section: string;
  envelope: string;
  title: string;
  description: string | null;
  type: string;
  risk: string;
  risk_reason: string | null;
  suggested_owner: string | null;
  owner: string | null;
  due_date: string | null;
  status: string;
  source_page: number | null;
  source_span: string | null;
  edited: boolean;
  superseded: boolean;
}

export interface Deliverable {
  id: string;
  requirement_id: string;
  title: string;
  expected_detail: string | null;
  status: string;
  owner: string | null;
  due_date: string | null;
}

export interface RunDiff {
  version: number;
  added: number;
  removed: number;
  carried_edited: number;
  requirement_count: number;
  deliverable_count: number;
}

function rid(p: string): string {
  return `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
}

// ---------- pure merge: human edits win ----------

export function mergeExtraction(
  existing: Requirement[],
  existingDelivs: Deliverable[],
  tenderId: string,
  extracted: ExtractedRequirement[],
  version: number
): { reqs: Requirement[]; delivs: Deliverable[]; diff: RunDiff } {
  const byTitle = new Map(existing.filter((r) => !r.superseded).map((r) => [norm(r.title), r]));
  const seen = new Set<string>();
  const reqs: Requirement[] = [];
  const delivs: Deliverable[] = [];
  let added = 0;
  let carried = 0;

  for (const e of extracted) {
    const key = norm(e.title);
    if (seen.has(key)) continue;
    seen.add(key);
    const prev = byTitle.get(key);
    if (prev) {
      const kept: Requirement = {
        ...prev,
        run_version: version,
        section: prev.edited ? prev.section : e.section,
        envelope: prev.edited ? prev.envelope : (e.envelope ?? "Technical"),
        title: prev.edited ? prev.title : e.title,
        description: e.description,
        type: prev.edited ? prev.type : e.type,
        risk: prev.edited ? prev.risk : e.risk,
        risk_reason: e.risk_reason,
        suggested_owner: e.suggested_owner,
        owner: prev.edited ? prev.owner : (prev.owner ?? e.suggested_owner),
        source_page: e.source_page,
        source_span: e.source_span,
        superseded: false,
      };
      reqs.push(kept);
      if (prev.edited) carried++;
      // refresh sub-items unless the row was hand-edited (keep owner's items)
      const prevItems = existingDelivs.filter((d) => d.requirement_id === prev.id);
      if (prev.edited && prevItems.length > 0) {
        delivs.push(...prevItems);
      } else {
        for (const d of e.deliverables) {
          delivs.push({ id: rid("d"), requirement_id: prev.id, title: d.title, expected_detail: d.expected_detail, status: "outstanding", owner: kept.owner, due_date: null });
        }
      }
    } else {
      const id = rid("r");
      added++;
      reqs.push({
        id, tender_id: tenderId, run_version: version, section: e.section,
        envelope: e.envelope ?? "Technical",
        title: e.title, description: e.description, type: e.type, risk: e.risk,
        risk_reason: e.risk_reason, suggested_owner: e.suggested_owner,
        owner: e.suggested_owner, due_date: null, status: "outstanding",
        source_page: e.source_page, source_span: e.source_span,
        edited: false, superseded: false,
      });
      for (const d of e.deliverables) {
        delivs.push({ id: rid("d"), requirement_id: id, title: d.title, expected_detail: d.expected_detail, status: "outstanding", owner: e.suggested_owner, due_date: null });
      }
    }
  }

  // Old rows missing from the new extraction: supersede, unless hand-edited.
  const removed: Requirement[] = [];
  for (const prev of existing) {
    if (prev.superseded || seen.has(norm(prev.title))) continue;
    if (prev.edited) {
      reqs.push({ ...prev, run_version: version });
      carried++;
    } else {
      removed.push({ ...prev, superseded: true });
    }
  }

  return {
    reqs: [...reqs, ...removed],
    delivs,
    diff: { version, added, removed: removed.length, carried_edited: carried, requirement_count: reqs.filter((r) => !r.superseded).length, deliverable_count: delivs.length },
  };
}

// ---------- local JSON mirror ----------

interface LocalDoc { requirements: Requirement[]; deliverables: Deliverable[]; runs: { id: string; tender_id: string; version: number; engine: string; requirement_count: number; deliverable_count: number; meta?: Record<string, unknown>; created_at: string }[]; }

async function docFile(): Promise<string> {
  await fs.mkdir(uploadsDir(), { recursive: true });
  return path.join(uploadsDir(), "requirements.json");
}

async function readDoc(): Promise<LocalDoc> {
  try {
    const raw = await fs.readFile(await docFile(), "utf8");
    const d = JSON.parse(raw);
    return { requirements: d.requirements ?? [], deliverables: d.deliverables ?? [], runs: d.runs ?? [] };
  } catch {
    return { requirements: [], deliverables: [], runs: [] };
  }
}

// ---------- Postgres ----------

async function pool() {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

function toReq(row: Record<string, unknown>): Requirement {
  return {
    id: String(row.id), tender_id: String(row.tender_id), run_version: Number(row.run_version),
    section: String(row.section ?? "General"), envelope: String(row.envelope ?? "Technical"), title: String(row.title ?? ""),
    description: (row.description as string) ?? null, type: String(row.type ?? "doc"),
    risk: String(row.risk ?? "mandatory"), risk_reason: (row.risk_reason as string) ?? null,
    suggested_owner: (row.suggested_owner as string) ?? null, owner: (row.owner as string) ?? null,
    due_date: (row.due_date as string) ?? null, status: String(row.status ?? "outstanding"),
    source_page: row.source_page == null ? null : Number(row.source_page),
    source_span: (row.source_span as string) ?? null,
    edited: Boolean(row.edited), superseded: Boolean(row.superseded),
  };
}

function toDeliv(row: Record<string, unknown>): Deliverable {
  return {
    id: String(row.id), requirement_id: String(row.requirement_id), title: String(row.title ?? ""),
    expected_detail: (row.expected_detail as string) ?? null, status: String(row.status ?? "outstanding"),
    owner: (row.owner as string) ?? null, due_date: (row.due_date as string) ?? null,
  };
}

// ---------- facade ----------

export async function nextVersion(tenderId: string): Promise<number> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT COALESCE(MAX(version),0) AS v FROM extraction_runs WHERE tender_id=$1", [tenderId]);
        return Number(r.rows[0].v) + 1;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  const vs = doc.runs.filter((r) => r.tender_id === tenderId).map((r) => r.version);
  return (vs.length ? Math.max(...vs) : 0) + 1;
}

export async function getActive(tenderId: string): Promise<{ requirements: Requirement[]; deliverables: Deliverable[]; backend: "postgres" | "local" }> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT * FROM requirements WHERE tender_id=$1 AND superseded=FALSE ORDER BY created_at", [tenderId]);
        const ids = r.rows.map((x) => x.id);
        let delivs: Deliverable[] = [];
        if (ids.length) {
          const d = await p.query("SELECT * FROM deliverables WHERE requirement_id = ANY($1)", [ids]);
          delivs = d.rows.map(toDeliv);
        }
        return { requirements: r.rows.map(toReq), deliverables: delivs, backend: "postgres" };
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  const reqs = doc.requirements
    .filter((x) => x.tender_id === tenderId && !x.superseded)
    .map((x) => ({ ...x, envelope: x.envelope ?? "Technical" }));
  const ids = new Set(reqs.map((x) => x.id));
  return { requirements: reqs, deliverables: doc.deliverables.filter((d) => ids.has(d.requirement_id)), backend: "local" };
}

export async function saveRun(
  tenderId: string, extracted: ExtractedRequirement[], engine = "heuristic/v2",
  meta: unknown = {}
): Promise<{ diff: RunDiff; backend: "postgres" | "local" }> {
  const version = await nextVersion(tenderId);
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        await p.query("BEGIN");
        const er = await p.query("SELECT * FROM requirements WHERE tender_id=$1", [tenderId]);
        const ed = await p.query("SELECT d.* FROM deliverables d JOIN requirements r ON r.id=d.requirement_id WHERE r.tender_id=$1", [tenderId]);
        const { reqs, delivs, diff } = mergeExtraction(er.rows.map(toReq), ed.rows.map(toDeliv), tenderId, extracted, version);
        for (const r of reqs) {
          await p.query(
            `INSERT INTO requirements (id,tender_id,run_version,section,envelope,title,description,type,risk,risk_reason,suggested_owner,owner,due_date,status,source_page,source_span,edited,superseded)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             ON CONFLICT (id) DO UPDATE SET run_version=$3,section=$4,envelope=$5,title=$6,description=$7,type=$8,risk=$9,risk_reason=$10,suggested_owner=$11,owner=$12,due_date=$13,status=$14,source_page=$15,source_span=$16,edited=$17,superseded=$18`,
            [r.id, r.tender_id, r.run_version, r.section, r.envelope, r.title, r.description, r.type, r.risk, r.risk_reason, r.suggested_owner, r.owner, r.due_date, r.status, r.source_page, r.source_span, r.edited, r.superseded]
          );
        }
        await p.query("DELETE FROM deliverables WHERE requirement_id IN (SELECT id FROM requirements WHERE tender_id=$1)", [tenderId]);
        for (const d of delivs) {
          await p.query("INSERT INTO deliverables (id,requirement_id,title,expected_detail,status,owner,due_date) VALUES ($1,$2,$3,$4,$5,$6,$7)",
            [d.id, d.requirement_id, d.title, d.expected_detail, d.status, d.owner, d.due_date]);
        }
        await p.query("INSERT INTO extraction_runs (id,tender_id,version,engine,requirement_count,deliverable_count,meta) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [rid("x"), tenderId, version, engine, diff.requirement_count, diff.deliverable_count, JSON.stringify(meta)]);
        await p.query("COMMIT");
        return { diff, backend: "postgres" };
      } catch (e) {
        await p.query("ROLLBACK");
        throw e;
      } finally {
        await p.end();
      }
    } catch { /* fall through to local */ }
  }
  const doc = await readDoc();
  const { reqs, delivs, diff } = mergeExtraction(
    doc.requirements.filter((x) => x.tender_id === tenderId),
    doc.deliverables.filter((d) => doc.requirements.some((x) => x.id === d.requirement_id && x.tender_id === tenderId)),
    tenderId, extracted, version
  );
  const others = doc.requirements.filter((x) => x.tender_id !== tenderId);
  const otherIds = new Set(others.map((x) => x.id));
  doc.requirements = [...others, ...reqs];
  doc.deliverables = [...doc.deliverables.filter((d) => otherIds.has(d.requirement_id)), ...delivs];
  doc.runs.push({ id: rid("x"), tender_id: tenderId, version, engine, requirement_count: diff.requirement_count, deliverable_count: diff.deliverable_count, meta: meta as Record<string, unknown>, created_at: new Date().toISOString() });
  await fs.writeFile(await docFile(), JSON.stringify(doc, null, 2), "utf8");
  return { diff, backend: "local" };
}

const PATCHABLE = ["title", "owner", "due_date", "status", "type", "risk", "section", "envelope"] as const;

export async function updateRequirement(id: string, patch: Record<string, unknown>): Promise<Requirement | null> {
  const clean: Record<string, unknown> = {};
  for (const k of PATCHABLE) if (patch[k] !== undefined) clean[k] = patch[k];
  if (Object.keys(clean).length === 0) return null;
  const sets = Object.keys(clean).map((k, i) => `${k}=$${i + 1}`);
  const vals = Object.values(clean);

  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query(`UPDATE requirements SET ${sets.join(",")}, edited=TRUE WHERE id=$${vals.length + 1} RETURNING *`, [...vals, id]);
        return r.rows.length ? toReq(r.rows[0]) : null;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  const r = doc.requirements.find((x) => x.id === id);
  if (!r) return null;
  Object.assign(r, clean, { edited: true });
  await fs.writeFile(await docFile(), JSON.stringify(doc, null, 2), "utf8");
  return r;
}

// ---------- Phase 5 helpers ----------

export async function getRequirement(id: string): Promise<Requirement | null> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT * FROM requirements WHERE id=$1", [id]);
        return r.rows.length ? toReq(r.rows[0]) : null;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  return doc.requirements.find((x) => x.id === id) ?? null;
}

const DELIV_PATCHABLE = ["title", "owner", "due_date", "status"] as const;

export async function updateDeliverable(id: string, patch: Record<string, unknown>): Promise<{ deliv: Deliverable; tender_id: string } | null> {
  const clean: Record<string, unknown> = {};
  for (const k of DELIV_PATCHABLE) if (patch[k] !== undefined) clean[k] = patch[k];
  if (Object.keys(clean).length === 0) return null;

  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const sets = Object.keys(clean).map((k, i) => `${k}=$${i + 1}`);
        const r = await p.query(
          `UPDATE deliverables SET ${sets.join(",")} WHERE id=$${Object.keys(clean).length + 1} RETURNING *,
           (SELECT tender_id FROM requirements WHERE id=deliverables.requirement_id) AS tender_id`,
          [...Object.values(clean), id]
        );
        if (!r.rows.length) return null;
        return { deliv: toDeliv(r.rows[0]), tender_id: String(r.rows[0].tender_id) };
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  const d = doc.deliverables.find((x) => x.id === id);
  if (!d) return null;
  Object.assign(d, clean);
  await fs.writeFile(await docFile(), JSON.stringify(doc, null, 2), "utf8");
  const req = doc.requirements.find((x) => x.id === d.requirement_id);
  return { deliv: d, tender_id: req?.tender_id ?? "" };
}

// Assign (Accept/Change): sets owner on the requirement and cascades to
// its deliverables unless they already have a specific owner.
export async function assignRequirement(id: string, owner: string, dueDate: string | null): Promise<Requirement | null> {
  const req = await getRequirement(id);
  if (!req || !owner.trim()) return null;
  const updated = await updateRequirement(id, { owner: owner.trim(), ...(dueDate ? { due_date: dueDate } : {}) });
  if (!updated) return null;

  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        await p.query("UPDATE deliverables SET owner=$1 WHERE requirement_id=$2 AND (owner IS NULL OR owner='')", [owner.trim(), id]);
        if (dueDate) await p.query("UPDATE deliverables SET due_date=$1 WHERE requirement_id=$2 AND due_date IS NULL", [dueDate, id]);
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  let touched = false;
  for (const d of doc.deliverables) {
    if (d.requirement_id !== id) continue;
    if (!d.owner) { d.owner = owner.trim(); touched = true; }
    if (dueDate && !d.due_date) { d.due_date = dueDate; touched = true; }
  }
  if (touched) await fs.writeFile(await docFile(), JSON.stringify(doc, null, 2), "utf8");
  return getRequirement(id);
}
