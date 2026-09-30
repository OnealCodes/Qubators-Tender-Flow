// AI refinement pass — heuristic matrix FIRST, Gemini classifies SECOND.
// The model never edits rows directly: it returns keep/drop suggestions with
// reasons, stored in ai_assessments. A human clicks Apply; drops supersede
// rows, merges stay manual (reported only). Heuristic output is untouched
// until Apply, so the run is fully reversible by re-running extraction.

import fs from "node:fs/promises";
import path from "node:path";
import { logActivity } from "./collab";
import { geminiJson, isGeminiConfigured } from "./gemini";
import { getActive } from "./requirements";
import { getTender, postgresReachable, uploadsDir } from "./tenders";

export type AiVerdict = "keep" | "drop";

export interface AiAssessment {
  id: string;
  requirement_id: string;
  verdict: AiVerdict;
  class: string;
  detail: string;
  merge_with: string | null;
  applied: boolean;
}

export interface AiRunSummary {
  run_id: string;
  model: string;
  keep: number;
  drop: number;
  chars_sent: number;
}

function rid(p: string): string {
  return `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const SYSTEM = `You review tender requirements extracted by a rule-based parser for an oil & gas bid team.
For EACH numbered row, classify it using its section, reference and wording:
- bid_submission: the bidder must submit, provide, complete, demonstrate or comply with this IN THE TENDER RESPONSE.
- commercial: pricing schedules, rates, price bases, commercial forms or pricing instructions.
- evaluation: scoring criteria or weights the client uses to judge bids (not submittable items).
- post_award: work, services or obligations that apply IF the contract is awarded (execution-phase), not submitted with the bid.
- informational: background, definitions, scope narrative or context — not actionable.
CRITICAL RULES:
- Never classify as bid_submission merely because words like "shall", "must", "required" or "contractor" appear. Use section context: "Mandatory Bid Content" means bid; "Scope of Work" execution narrative means post-award or informational.
- When unsure between bid_submission and post_award/informational, choose "keep" with class "bid_submission" ONLY if a bidder must act on it before the deadline; otherwise suggest "drop" with the honest class.
- Suggest "merge_with" (another row number) ONLY for near-duplicate rows about the same deliverable.
- Respond with STRICT JSON only, no markdown, no commentary:
{"assessments":[{"row":1,"verdict":"keep","class":"bid_submission","reason":"...","merge_with":null}]}`;

const CLASSES = ["bid_submission", "commercial", "evaluation", "post_award", "informational"];

interface Store {
  list(tenderId: string, runId?: string): Promise<AiAssessment[]>;
  save(items: (AiAssessment & { tender_id: string; run_id: string; model: string })[]): Promise<void>;
  apply(tenderId: string, runId: string): Promise<number>;
}

async function pool() {
  const { Pool } = await import("pg");
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

async function docFile(): Promise<string> {
  await fs.mkdir(uploadsDir(), { recursive: true });
  return path.join(uploadsDir(), "ai.json");
}

async function readDoc(): Promise<{ assessments: (AiAssessment & { tender_id: string; run_id: string; model: string; created_at: string })[] }> {
  try {
    const raw = await fs.readFile(await docFile(), "utf8");
    const d = JSON.parse(raw);
    return { assessments: d.assessments ?? [] };
  } catch {
    return { assessments: [] };
  }
}

export async function refineTender(tenderId: string): Promise<{ summary: AiRunSummary; assessments: AiAssessment[] }> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API key is not configured. Add GEMINI_API_KEY to tenderflow-app\\.env (see .env.example).");
  }
  const [{ requirements }, tenderRes] = await Promise.all([getActive(tenderId), getTender(tenderId)]);
  const active = requirements.filter((r) => !r.superseded);
  if (!active.length) throw new Error("No extracted requirements to refine. Run extraction first.");
  if (!tenderRes.tender) throw new Error("Tender not found.");

  const rows = active.map((r, i) => ({
    row: i + 1,
    id: r.id,
    ref: r.ref,
    section: r.section,
    envelope: (r as { envelope?: string }).envelope ?? "Technical",
    title: r.title,
    detail: (r.description ?? "").slice(0, 400),
  }));
  const userPrompt =
    `Tender: ${tenderRes.tender.title}\n` +
    `Rows (rule-based extraction, exact tender wording):\n` +
    rows.map((r) => `#${r.row} [ref ${r.ref ?? "none"} | ${r.section} | ${r.envelope}] ${r.title}\nDetail: ${r.detail}`).join("\n") +
    `\nClassify every row 1..${rows.length}.`;
  const chars_sent = userPrompt.length + SYSTEM.length;

  const parsed = (await geminiJson(SYSTEM, userPrompt)) as {
    data: {
      assessments?: { row?: number; verdict?: string; class?: string; reason?: string; merge_with?: number | null }[];
    };
    model: string;
  };
  const list = Array.isArray(parsed.data.assessments) ? parsed.data.assessments : [];
  const byRow = new Map(rows.map((r) => [r.row, r]));
  const run_id = rid("ai");
  const model = parsed.model;
  const items: (AiAssessment & { tender_id: string; run_id: string; model: string })[] = [];
  for (const a of list) {
    const target = typeof a.row === "number" ? byRow.get(a.row) : undefined;
    if (!target) continue;
    const verdict: AiVerdict = a.verdict === "drop" ? "drop" : "keep";
    const cls = typeof a.class === "string" && CLASSES.includes(a.class) ? a.class : "bid_submission";
    const mergeRow = typeof a.merge_with === "number" ? byRow.get(a.merge_with) : undefined;
    items.push({
      id: rid("aa"),
      tender_id: tenderId,
      run_id,
      requirement_id: target.id,
      verdict,
      class: cls,
      detail: typeof a.reason === "string" ? a.reason.slice(0, 500) : "",
      merge_with: mergeRow ? mergeRow.id : null,
      applied: false,
      model,
    });
  }
  if (!items.length) throw new Error("Gemini returned no usable assessments.");

  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        for (const it of items) {
          await p.query(
            "INSERT INTO ai_assessments (id,tender_id,requirement_id,run_id,verdict,detail,model) VALUES ($1,$2,$3,$4,$5,$6,$7)",
            [it.id, tenderId, it.requirement_id, run_id, it.verdict, `${it.class}: ${it.detail}${it.merge_with ? ` [merge candidate]` : ""}`, model]
          );
        }
      } finally {
        await p.end();
      }
    } catch { /* fall through to local */ }
  }
  // Local mirror always (audit trail even if Postgres hiccups).
  try {
    const doc = await readDoc();
    doc.assessments.unshift(
      ...items.map((it) => ({ ...it, created_at: new Date().toISOString() }))
    );
    await fs.writeFile(await docFile(), JSON.stringify(doc, null, 2), "utf8");
  } catch { /* ignore */ }

  await logActivity(tenderId, "ai_refine", {
    run_id,
    model,
    keep: items.filter((i) => i.verdict === "keep").length,
    drop: items.filter((i) => i.verdict === "drop").length,
  });
  return {
    summary: {
      run_id,
      model,
      keep: items.filter((i) => i.verdict === "keep").length,
      drop: items.filter((i) => i.verdict === "drop").length,
      chars_sent,
    },
    assessments: items,
  };
}

export async function listAssessments(tenderId: string, runId?: string): Promise<(AiAssessment & { model: string })[]> {
  void runId;
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        const r = await p.query(
          "SELECT a.*, (SELECT run_id FROM ai_assessments WHERE tender_id=$1 ORDER BY created_at DESC LIMIT 1) AS latest FROM ai_assessments a WHERE a.tender_id=$1 ORDER BY a.created_at DESC LIMIT 200",
          [tenderId]
        );
        if (r.rows.length) {
          return r.rows.map((x) => ({
            id: String(x.id),
            requirement_id: String(x.requirement_id),
            verdict: (x.verdict === "drop" ? "drop" : "keep") as AiVerdict,
            class: String(x.detail).split(":")[0] ?? "",
            detail: String(x.detail ?? ""),
            merge_with: null,
            applied: Boolean(x.applied),
            model: String(x.model ?? ""),
          }));
        }
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  const doc = await readDoc();
  return doc.assessments.filter((a) => a.tender_id === tenderId).slice(0, 200);
}

// Apply = supersede drop-suggested rows. Merges stay manual by design.
export async function applyAssessments(tenderId: string): Promise<{ applied: number }> {
  const all = await listAssessments(tenderId);
  const drops = all.filter((a) => a.verdict === "drop" && !a.applied);
  let applied = 0;
  if (await postgresReachable()) {
    try {
      const p = await pool();
      try {
        for (const d of drops) {
          await p.query("UPDATE requirements SET superseded=TRUE WHERE id=$1 AND tender_id=$2", [d.requirement_id, tenderId]);
          await p.query("UPDATE ai_assessments SET applied=TRUE WHERE id=$1", [d.id]);
          applied++;
        }
      } finally {
        await p.end();
      }
    } catch { /* fall through */ }
  }
  if (applied === 0) {
    // Local mirror path.
    try {
      const doc = await readDoc();
      const ids = new Set(drops.map((d) => d.requirement_id));
      const reqRaw = await fs.readFile(path.join(uploadsDir(), "requirements.json"), "utf8").catch(() => null);
      if (reqRaw) {
        const rdoc = JSON.parse(reqRaw);
        for (const r of rdoc.requirements ?? []) {
          if (ids.has(r.id) && r.tender_id === tenderId) {
            r.superseded = true;
            applied++;
          }
        }
        await fs.writeFile(path.join(uploadsDir(), "requirements.json"), JSON.stringify(rdoc, null, 2), "utf8");
      }
      for (const a of doc.assessments) {
        if (ids.has(a.requirement_id)) a.applied = true;
      }
      await fs.writeFile(await docFile(), JSON.stringify(doc, null, 2), "utf8");
    } catch { /* ignore */ }
  }
  await logActivity(tenderId, "ai_apply", { applied });
  return { applied };
}
