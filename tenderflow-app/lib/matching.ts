// Matching + expiry engines — pure functions, deterministic, no model calls.
// Rule-based heuristic v1: entity tags, token overlap, type agreement.
// Embeddings (pgvector) plug in later behind the same candidate shape.
// Matching NEVER approves compliance: candidates stay "proposed" until a
// human accepts. Expiry is computed, never guessed.

import type { LibraryDoc } from "./library";

export interface MatchCandidate {
  library_doc_id: string;
  name: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  expiry_badge: ExpiryBadge;
}

export type ExpiryLevel = "red" | "amber" | "green" | "grey";

export interface ExpiryBadge {
  level: ExpiryLevel;
  label: string;
}

const ENTITY_TAGS: { match: RegExp; tag: string }[] = [
  { match: /\bCO2\b/, tag: "CO2" },
  { match: /\bCO7\b/, tag: "CO7" },
  { match: /NOGIC(\s*JQS)?/i, tag: "NOGIC" },
  { match: /NUPRC/i, tag: "NUPRC" },
  { match: /NCDMB/i, tag: "NCDMB" },
  { match: /ISO\s*9001/i, tag: "ISO9001" },
  { match: /tax clearance/i, tag: "TAX" },
  { match: /insurance/i, tag: "INSURANCE" },
  { match: /HSE policy/i, tag: "HSE-POLICY" },
  { match: /safety programme/i, tag: "SAFETY" },
  { match: /\bJHA\b|job hazard analysis/i, tag: "JHA" },
  { match: /organogram/i, tag: "ORGANOGRAM" },
  { match: /\bCVs?\b/i, tag: "CV" },
  { match: /audit/i, tag: "AUDIT" },
  { match: /company profile/i, tag: "PROFILE" },
  { match: /parent company guarantee/i, tag: "PCG" },
];

function tagsOf(text: string): Set<string> {
  const tags = new Set<string>();
  for (const e of ENTITY_TAGS) if (e.match.test(text)) tags.add(e.tag);
  return tags;
}

function tokens(text: string): Set<string> {
  return new Set(
    text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !["the", "and", "for", "with", "certificate", "registration"].includes(t))
  );
}

export function scoreMatch(deliverableTitle: string, expectedDetail: string | null, doc: LibraryDoc): { confidence: "high" | "medium" | "low"; reasons: string[] } {
  const detail = expectedDetail ?? "";
  const docText = `${doc.name} ${doc.doc_type} ${doc.entity ?? ""}`;
  const reasons: string[] = [];
  let score = 0;

  // Title evidence weighs far more than surrounding context: a deliverable
  // for "2022 audited accounts" must not match via a passing mention.
  const titleShared = [...tagsOf(deliverableTitle)].filter((t) => tagsOf(docText).has(t));
  if (titleShared.length) {
    score += 3 + titleShared.length;
    reasons.push(`Same entity tag: ${titleShared.join(", ")}`);
  } else {
    const detailShared = [...tagsOf(detail)].filter((t) => tagsOf(docText).has(t) && !tagsOf(deliverableTitle).has(t));
    if (detailShared.length) {
      score += 1;
      reasons.push(`Mentioned in context: ${detailShared.join(", ")}`);
    }
  }
  const overlap = [...tokens(deliverableTitle)].filter((t) => tokens(`${doc.name} ${doc.doc_type}`).has(t));
  if (overlap.length) {
    score += Math.min(2, overlap.length);
    reasons.push(`Shared terms: ${overlap.slice(0, 4).join(", ")}`);
  }
  if (doc.entity && deliverableTitle.toLowerCase().includes(doc.entity.toLowerCase())) {
    score += 1;
    reasons.push(`Doc entity "${doc.entity}" named in deliverable`);
  }
  const confidence = score >= 4 ? "high" : score >= 2 ? "medium" : "low";
  return { confidence, reasons };
}

export function matchDeliverable(
  deliverableTitle: string,
  expectedDetail: string | null,
  docs: LibraryDoc[]
): MatchCandidate[] {
  return docs
    .filter((d) => !d.superseded)
    .map((d) => {
      const { confidence, reasons } = scoreMatch(deliverableTitle, expectedDetail, d);
      return {
        library_doc_id: d.id,
        name: d.name,
        confidence,
        reasons,
        expiry_badge: expiryBadge(d.expiry_date, null),
      };
    })
    .filter((c) => c.confidence !== "low")
    .sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === "high" ? -1 : 1))
    .slice(0, 3);
}

// ---------- expiry engine ----------

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Red: expired or expires before submission. Amber: expires within 90 days
 *  after submission (or within 60 days with no submission date). Else green. */
export function expiryBadge(expiry: string | null, submissionDeadline: string | null, now = new Date()): ExpiryBadge {
  const exp = parseDate(expiry);
  if (!exp) return { level: "grey", label: "No expiry" };
  const sub = parseDate(submissionDeadline);
  const day = 24 * 3600 * 1000;
  if (exp.getTime() < now.getTime()) return { level: "red", label: `Expired ${expiry}` };
  if (sub && exp.getTime() < sub.getTime()) return { level: "red", label: `Expires before submission (${expiry})` };
  const ref = sub ?? now;
  if (exp.getTime() - ref.getTime() < (sub ? 90 : 60) * day)
    return { level: "amber", label: `Expiring soon (${expiry})` };
  return { level: "green", label: `Valid to ${expiry}` };
}
