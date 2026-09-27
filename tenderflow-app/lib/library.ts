// Company document library — CRUD + dedup + version history.
// Postgres when reachable, local JSON mirror otherwise (same shape).

import fs from "node:fs/promises";
import path from "node:path";
import { postgresReachable, uploadsDir } from "./tenders";

export interface LibraryDoc {
  id: string;
  company_id: string;
  name: string;
  doc_type: string;
  version: string;
  version_no: number;
  superseded: boolean;
  issue_date: string | null;
  expiry_date: string | null;
  dept: string | null;
  entity: string | null;
  storage_path: string | null;
  file_size: number;
  status: string;
  created_at: string;
}

export interface EvidenceLink {
  id: string;
  deliverable_id: string;
  library_doc_id: string;
  match_confidence: string;
  match_reasons: string;
  status: string;
  accepted_by: string | null;
  accepted_at: string | null;
}

const COMPANY_ID = "demo-company";

function rid(p: string): string {
  return `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- local JSON mirror ----------

interface LocalDoc { library: LibraryDoc[]; links: EvidenceLink[]; }

async function docFile(): Promise<string> {
  await fs.mkdir(uploadsDir(), { recursive: true });
  return path.join(uploadsDir(), "library.json");
}

async function readDoc(): Promise<LocalDoc> {
  try {
    const raw = await fs.readFile(await docFile(), "utf8");
    const d = JSON.parse(raw);
    return { library: d.library ?? [], links: d.links ?? [] };
  } catch {
    return { library: [], links: [] };
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

function toDoc(r: Record<string, unknown>): LibraryDoc {
  return {
    id: String(r.id), company_id: String(r.company_id), name: String(r.name ?? ""),
    doc_type: String(r.doc_type ?? "general"), version: String(r.version ?? "v1"),
    version_no: Number(r.version_no ?? 1), superseded: Boolean(r.superseded),
    issue_date: (r.issue_date as string) ?? null, expiry_date: (r.expiry_date as string) ?? null,
    dept: (r.dept as string) ?? null, entity: (r.entity as string) ?? null,
    storage_path: (r.storage_path as string) ?? null, file_size: Number(r.file_size ?? 0),
    status: String(r.status ?? "valid"), created_at: String(r.created_at ?? ""),
  };
}

function toLink(r: Record<string, unknown>): EvidenceLink {
  return {
    id: String(r.id), deliverable_id: String(r.deliverable_id), library_doc_id: String(r.library_doc_id),
    match_confidence: String(r.match_confidence ?? "low"), match_reasons: String(r.match_reasons ?? ""),
    status: String(r.status ?? "proposed"),
    accepted_by: (r.accepted_by as string) ?? null, accepted_at: (r.accepted_at as string) ?? null,
  };
}

// ---------- CRUD ----------

export interface DocInput {
  name: string;
  doc_type?: string;
  version?: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  dept?: string | null;
  entity?: string | null;
  storage_path?: string | null;
  file_size?: number;
}

export async function listDocs(includeSuperseded = false): Promise<LibraryDoc[]> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query(
          "SELECT * FROM library_docs WHERE company_id=$1 AND ($2 OR superseded=FALSE) ORDER BY name, version_no DESC",
          [COMPANY_ID, includeSuperseded]
        );
        return r.rows.map(toDoc);
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  return doc.library.filter((d) => includeSuperseded || !d.superseded);
}

// Dedup: same name + entity starts a new version, superseding the old row.
export async function addDoc(input: DocInput): Promise<{ doc: LibraryDoc; deduped: boolean }> {
  if (!input.name?.trim()) throw new Error("Name is required.");
  const existing = (await listDocs()).filter(
    (d) => d.name.toLowerCase() === input.name.trim().toLowerCase() && (d.entity ?? "") === (input.entity ?? "")
  );
  const version_no = existing.length ? Math.max(...existing.map((d) => d.version_no)) + 1 : 1;
  const doc: LibraryDoc = {
    id: rid("l"), company_id: COMPANY_ID, name: input.name.trim(),
    doc_type: input.doc_type ?? "general", version: input.version ?? `v${version_no}`,
    version_no, superseded: false,
    issue_date: input.issue_date ?? null, expiry_date: input.expiry_date ?? null,
    dept: input.dept ?? null, entity: input.entity ?? null,
    storage_path: input.storage_path ?? null, file_size: input.file_size ?? 0,
    status: "valid", created_at: new Date().toISOString(),
  };

  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        await p.query("BEGIN");
        for (const old of existing) {
          await p.query("UPDATE library_docs SET superseded=TRUE WHERE id=$1", [old.id]);
        }
        await p.query(
          `INSERT INTO library_docs (id,company_id,name,doc_type,version,version_no,issue_date,expiry_date,dept,entity,storage_path,file_size)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [doc.id, COMPANY_ID, doc.name, doc.doc_type, doc.version, version_no, doc.issue_date, doc.expiry_date, doc.dept, doc.entity, doc.storage_path, doc.file_size]
        );
        await p.query("COMMIT");
        return { doc, deduped: existing.length > 0 };
      } catch (e) {
        await p.query("ROLLBACK");
        throw e;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const store = await readDoc();
  for (const old of existing) {
    const row = store.library.find((d) => d.id === old.id);
    if (row) row.superseded = true;
  }
  store.library.unshift(doc);
  await writeDoc(store);
  return { doc, deduped: existing.length > 0 };
}

const DOC_PATCHABLE = ["name", "doc_type", "version", "issue_date", "expiry_date", "dept", "entity", "status"] as const;

export async function updateDoc(id: string, patch: Record<string, unknown>): Promise<LibraryDoc | null> {
  const clean: Record<string, unknown> = {};
  for (const k of DOC_PATCHABLE) if (patch[k] !== undefined) clean[k] = patch[k];
  if (!Object.keys(clean).length) return null;
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const sets = Object.keys(clean).map((k, i) => `${k}=$${i + 1}`);
        const r = await p.query(`UPDATE library_docs SET ${sets.join(",")} WHERE id=$${sets.length + 1} AND company_id=$${sets.length + 2} RETURNING *`,
          [...Object.values(clean), id, COMPANY_ID]);
        return r.rows.length ? toDoc(r.rows[0]) : null;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const store = await readDoc();
  const d = store.library.find((x) => x.id === id);
  if (!d) return null;
  Object.assign(d, clean);
  await writeDoc(store);
  return d;
}

export async function deleteDoc(id: string): Promise<boolean> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("DELETE FROM library_docs WHERE id=$1 AND company_id=$2", [id, COMPANY_ID]);
        return (r.rowCount ?? 0) > 0;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const store = await readDoc();
  const before = store.library.length;
  store.library = store.library.filter((d) => d.id !== id);
  store.links = store.links.filter((l) => l.library_doc_id !== id);
  await writeDoc(store);
  return store.library.length < before;
}

// ---------- evidence links (proposed → accepted | rejected; never auto) ----------

export async function upsertLink(deliverableId: string, libraryDocId: string, confidence: string, reasons: string): Promise<EvidenceLink> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query(
          `INSERT INTO evidence_links (id,deliverable_id,library_doc_id,match_confidence,match_reasons)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (deliverable_id,library_doc_id) DO UPDATE SET match_confidence=$4, match_reasons=$5
           RETURNING *`,
          [rid("k"), deliverableId, libraryDocId, confidence, reasons]
        );
        return toLink(r.rows[0]);
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const store = await readDoc();
  const found = store.links.find((l) => l.deliverable_id === deliverableId && l.library_doc_id === libraryDocId);
  if (found) {
    found.match_confidence = confidence;
    found.match_reasons = reasons;
    await writeDoc(store);
    return found;
  }
  const link: EvidenceLink = { id: rid("k"), deliverable_id: deliverableId, library_doc_id: libraryDocId, match_confidence: confidence, match_reasons: reasons, status: "proposed", accepted_by: null, accepted_at: null };
  store.links.unshift(link);
  await writeDoc(store);
  return link;
}

export async function decideLink(deliverableId: string, libraryDocId: string, accept: boolean, by = "bid-manager"): Promise<EvidenceLink | null> {
  const status = accept ? "accepted" : "rejected";
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query(
          "UPDATE evidence_links SET status=$1, accepted_by=$2, accepted_at=now() WHERE deliverable_id=$3 AND library_doc_id=$4 RETURNING *",
          [status, accept ? by : null, deliverableId, libraryDocId]
        );
        return r.rows.length ? toLink(r.rows[0]) : null;
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const store = await readDoc();
  const link = store.links.find((l) => l.deliverable_id === deliverableId && l.library_doc_id === libraryDocId);
  if (!link) return null;
  link.status = status;
  link.accepted_by = accept ? by : null;
  link.accepted_at = accept ? new Date().toISOString() : null;
  await writeDoc(store);
  return link;
}

export async function linksFor(deliverableIds: string[]): Promise<EvidenceLink[]> {
  if (!deliverableIds.length) return [];
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT * FROM evidence_links WHERE deliverable_id = ANY($1)", [deliverableIds]);
        if (r.rows.length) return r.rows.map(toLink);
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const store = await readDoc();
  const set = new Set(deliverableIds);
  return store.links.filter((l) => set.has(l.deliverable_id));
}
