// QC persistence + orchestration — run engine over real sources, store the
// verdict with its checks, allow human override (verdict + reason required).
// Postgres when reachable, local JSON mirror otherwise (same shape).

import fs from "node:fs/promises";
import path from "node:path";
import { logActivity } from "./collab";
import { refineRisk, runQc, type QcCheck, type QcVerdict } from "./qc";
import { getActive } from "./requirements";
import { postgresReachable, uploadsDir } from "./tenders";

export interface QcRecord {
  id: string;
  deliverable_id: string;
  source_kind: string;
  source_label: string | null;
  verdict: QcVerdict;
  checks: QcCheck[];
  action: string | null;
  engine: string;
  created_at: string;
  review?: { reviewer: string; verdict: QcVerdict; note: string; created_at: string } | null;
  effective?: QcVerdict;
}

function rid(p: string): string {
  return `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- local JSON mirror ----------

interface LocalDoc {
  results: QcRecord[];
  reviews: { id: string; qc_result_id: string; reviewer: string; verdict: QcVerdict; note: string; created_at: string }[];
}

async function docFile(): Promise<string> {
  await fs.mkdir(uploadsDir(), { recursive: true });
  return path.join(uploadsDir(), "qc.json");
}

async function readDoc(): Promise<LocalDoc> {
  try {
    const raw = await fs.readFile(await docFile(), "utf8");
    const d = JSON.parse(raw);
    return { results: d.results ?? [], reviews: d.reviews ?? [] };
  } catch {
    return { results: [], reviews: [] };
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

function toRecord(r: Record<string, unknown>): QcRecord {
  return {
    id: String(r.id), deliverable_id: String(r.deliverable_id),
    source_kind: String(r.source_kind ?? "none"), source_label: (r.source_label as string) ?? null,
    verdict: String(r.verdict ?? "not_reviewed") as QcVerdict,
    checks: (r.checks as QcCheck[]) ?? [], action: (r.action as string) ?? null,
    engine: String(r.engine ?? "rules/v1"), created_at: String(r.created_at ?? ""),
  };
}

async function withReview(rec: QcRecord): Promise<QcRecord> {
  const review = await latestReview(rec.id);
  return { ...rec, review, effective: review?.verdict ?? rec.verdict };
}

async function latestReview(qcId: string) {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT * FROM qc_reviews WHERE qc_result_id=$1 ORDER BY created_at DESC LIMIT 1", [qcId]);
        if (r.rows.length) {
          const x = r.rows[0];
          return { reviewer: String(x.reviewer), verdict: String(x.verdict) as QcVerdict, note: String(x.note), created_at: String(x.created_at) };
        }
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  const revs = doc.reviews.filter((x) => x.qc_result_id === qcId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const x = revs[0];
  return x ? { reviewer: x.reviewer, verdict: x.verdict, note: x.note, created_at: x.created_at } : null;
}

// ---------- source resolution: latest evidence (parsed if PDF) → accepted link → none ----------

async function resolveSource(deliverableId: string, tenderId: string) {
  // latest evidence file
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT * FROM evidence WHERE deliverable_id=$1 ORDER BY created_at DESC LIMIT 1", [deliverableId]);
        if (r.rows.length) {
          const e = r.rows[0];
          return { kind: "evidence" as const, label: String(e.file_name), path: String(e.storage_path) };
        }
        const l = await p.query(
          `SELECT l.*, d.name, d.doc_type, d.entity, d.expiry_date FROM evidence_links l
           JOIN library_docs d ON d.id=l.library_doc_id
           WHERE l.deliverable_id=$1 AND l.status='accepted' ORDER BY l.accepted_at DESC LIMIT 1`,
          [deliverableId]
        );
        if (l.rows.length) {
          const x = l.rows[0];
          return { kind: "library" as const, label: String(x.name), text: `${x.name} ${x.doc_type} ${x.entity ?? ""}`, fileName: String(x.name), expiry: (x.expiry_date as string) ?? null };
        }
      } finally {
        await p.end();
      }
    } catch { /* fall through to local */ }
  }
  try {
    const raw = await fs.readFile(path.join(uploadsDir(), "collab.json"), "utf8");
    const doc = JSON.parse(raw);
    const ev = (doc.evidence ?? []).filter((e: { deliverable_id: string }) => e.deliverable_id === deliverableId).sort((a: { created_at: string }, b: { created_at: string }) => (a.created_at < b.created_at ? 1 : -1))[0];
    if (ev) return { kind: "evidence" as const, label: String(ev.file_name), path: String(ev.storage_path) };
    const lib = JSON.parse(await fs.readFile(path.join(uploadsDir(), "library.json"), "utf8").catch(() => '{"library":[],"links":[]}'));
    const link = (lib.links ?? []).find((l: { deliverable_id: string; status: string }) => l.deliverable_id === deliverableId && l.status === "accepted");
    if (link) {
      const d = (lib.library ?? []).find((x: { id: string }) => x.id === link.library_doc_id);
      if (d) return { kind: "library" as const, label: String(d.name), text: `${d.name} ${d.doc_type} ${d.entity ?? ""}`, fileName: String(d.name), expiry: d.expiry_date ?? null };
    }
  } catch { /* no local sources */ }
  return { kind: "none" as const, label: "No source" };
}

export interface RunResult {
  record: QcRecord;
  backend: "postgres" | "local";
}

export async function runQcForDeliverable(tenderId: string, deliverableId: string): Promise<RunResult> {
  const { requirements, deliverables } = await getActive(tenderId);
  const deliv = deliverables.find((d) => d.id === deliverableId);
  if (!deliv) throw new Error("Deliverable not found.");
  const req = requirements.find((r) => r.id === deliv.requirement_id);

  const src = await resolveSource(deliverableId, tenderId);
  let text: string | undefined;
  let fileName: string | undefined;
  let expiry: string | null | undefined;
  let sourceKind: "evidence" | "library" | "text" | "none" = "none";
  let sourceLabel = "No source";
  if (src.kind === "evidence") {
    sourceKind = "evidence";
    sourceLabel = src.label;
    fileName = src.label;
    const p = (src as { path?: string }).path;
    if (p && /\.pdf$/i.test(p)) {
      try {
        const buf = await fs.readFile(p);
        const { parsePdf } = await import("./pdf");
        const parsed = await parsePdf(buf);
        text = parsed.pages.map((x) => x.text).join("\n");
      } catch { /* unreadable PDF → filename-only evidence */ }
    }
  } else if (src.kind === "library") {
    sourceKind = "library";
    sourceLabel = (src as { label: string }).label;
    text = (src as { text?: string }).text;
    fileName = (src as { fileName?: string }).fileName;
    expiry = (src as { expiry?: string | null }).expiry;
  }

  // Tender submission date for expiry checks + company entity for consistency.
  let submission: string | null = null;
  try {
    const { getTender } = await import("./tenders");
    const t = await getTender(tenderId);
    submission = t.tender?.submission_deadline ?? null;
  } catch { /* ignore */ }

  const result = runQc(
    {
      deliverableTitle: deliv.title,
      expectedDetail: deliv.expected_detail,
      requirementTitle: req?.title ?? null,
      requirementType: req?.type ?? null,
      companyEntity: null,
      submissionDeadline: submission,
    },
    { kind: sourceKind, label: sourceLabel, text, fileName, expiry }
  );

  // Risk engine refines the requirement's risk (system field, always updated).
  if (req) {
    const assessed = refineRisk(req.title, req.description);
    if (assessed.risk !== req.risk) {
      const { updateRequirement } = await import("./requirements");
      await updateRequirement(req.id, { risk: assessed.risk });
      // keep the human-readable reason alongside
      if (await postgresReachable()) {
        try {
          const p = await pool();
          try {
            await p.query("UPDATE requirements SET risk_reason=$1 WHERE id=$2", [assessed.reason, req.id]);
          } finally {
            await p.end();
          }
        } catch { /* ignore */ }
      }
    }
  }

  const record: QcRecord = {
    id: rid("q"), deliverable_id: deliverableId, source_kind: sourceKind, source_label: sourceLabel,
    verdict: result.verdict, checks: result.checks, action: result.action,
    engine: "rules/v1", created_at: new Date().toISOString(),
  };

  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        await p.query(
          "INSERT INTO qc_results (id,deliverable_id,source_kind,source_label,verdict,checks,action,engine) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [record.id, deliverableId, sourceKind, sourceLabel, result.verdict, JSON.stringify(result.checks), result.action, "rules/v1"]
        );
        await logActivity(tenderId, "qc", { deliverable_id: deliverableId, verdict: result.verdict });
        return { record: await withReview(record), backend: "postgres" };
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  doc.results.unshift(record);
  await writeDoc(doc);
  await logActivity(tenderId, "qc", { deliverable_id: deliverableId, verdict: result.verdict });
  return { record: await withReview(record), backend: "local" };
}

export async function historyFor(deliverableId: string): Promise<QcRecord[]> {
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query("SELECT * FROM qc_results WHERE deliverable_id=$1 ORDER BY created_at DESC", [deliverableId]);
        if (r.rows.length) {
          const out: QcRecord[] = [];
          for (const row of r.rows) out.push(await withReview(toRecord(row)));
          return out;
        }
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  const rows = doc.results.filter((x) => x.deliverable_id === deliverableId);
  const out: QcRecord[] = [];
  for (const rec of rows) out.push(await withReview(rec));
  return out;
}

const REVIEW_VERDICTS: QcVerdict[] = ["compliant", "review", "non_compliant", "not_reviewed"];

export async function addReview(qcId: string, verdict: string, note: string, reviewer = "bid-manager"): Promise<QcRecord | null> {
  if (!REVIEW_VERDICTS.includes(verdict as QcVerdict) || !note.trim()) return null;
  const entry = { id: rid("v"), qc_result_id: qcId, reviewer, verdict: verdict as QcVerdict, note: note.trim(), created_at: new Date().toISOString() };
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        await p.query("INSERT INTO qc_reviews (id,qc_result_id,reviewer,verdict,note) VALUES ($1,$2,$3,$4,$5)",
          [entry.id, qcId, reviewer, verdict, entry.note]);
        const r = await p.query("SELECT * FROM qc_results WHERE id=$1", [qcId]);
        if (!r.rows.length) return null;
        return withReview(toRecord(r.rows[0]));
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  const rec = doc.results.find((x) => x.id === qcId);
  if (!rec) return null;
  doc.reviews.unshift(entry);
  await writeDoc(doc);
  return withReview(rec);
}

export interface TenderQcRow {
  deliverable_id: string;
  requirement_id: string;
  title: string;
  owner: string | null;
  status: string;
  requirement_type: string | null;
  latest: QcRecord | null;
}

export async function tenderQc(tenderId: string): Promise<{ rows: TenderQcRow[]; counts: Record<string, number>; backend: "postgres" | "local" }> {
  const { requirements, deliverables, backend } = await getActive(tenderId);
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const rows: TenderQcRow[] = [];
  for (const d of deliverables) {
    const hist = await historyFor(d.id);
    rows.push({
      deliverable_id: d.id,
      requirement_id: d.requirement_id,
      title: d.title,
      owner: d.owner,
      status: d.status,
      requirement_type: reqById.get(d.requirement_id)?.type ?? null,
      latest: hist[0] ?? null,
    });
  }
  const counts: Record<string, number> = { compliant: 0, review: 0, non_compliant: 0, not_reviewed: 0 };
  for (const r of rows) counts[r.latest?.effective ?? "not_reviewed"]++;
  return { rows, counts, backend };
}
