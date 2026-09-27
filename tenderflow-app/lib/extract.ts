// Heuristic requirement extractor v1 — deterministic, local, no model calls.
// Produces extract/v1-shaped rows: parent requirement → deliverables,
// type + risk + reason, suggested owner, source page + span. The LLM
// extract/v1 adapter plugs into the same output shape later (ADR-004).

import type { ParsedPage } from "./pdf";

export interface ExtractedDeliverable {
  title: string;
  expected_detail: string;
}

export interface ExtractedRequirement {
  section: string;
  title: string;
  description: string;
  type: string;
  risk: string;
  risk_reason: string;
  suggested_owner: string | null;
  source_page: number;
  source_span: string;
  deliverables: ExtractedDeliverable[];
}

const OBLIGATION = /\b(provide|submit|complete|sign|ensure|include|attach|demonstrate|quote|present|furnish|supply|undertake|maintain|obtain)\b/i;

const ENTITIES: { match: RegExp; label: string }[] = [
  { match: /\bCO2\b/, label: "CO2 certificate" },
  { match: /\bCO7\b/, label: "CO7 certificate" },
  { match: /NOGIC(\s*JQS)?/i, label: "NOGIC JQS registration" },
  { match: /NUPRC/i, label: "NUPRC certificate" },
  { match: /NCDMB/i, label: "NCDMB compliance documents" },
  { match: /ISO\s*9001/i, label: "ISO 9001 certificate" },
  { match: /tax clearance/i, label: "Tax clearance certificate" },
  { match: /insurance/i, label: "Insurance certificate" },
  { match: /HSE policy/i, label: "HSE policy" },
  { match: /safety programme/i, label: "Safety programme" },
  { match: /\bJHA\b|job hazard analysis/i, label: "Job hazard analysis" },
  { match: /organogram|organizational chart/i, label: "Organogram" },
  { match: /\bCVs?\b|curriculum vitae/i, label: "Personnel CVs" },
  { match: /company profile/i, label: "Company profile" },
  { match: /parent company guarantee/i, label: "Parent Company Guarantee" },
  { match: /bid bond/i, label: "Bid bond" },
];

const SECTION_TERMS: { match: RegExp; section: string }[] = [
  { match: /nigerian content|local content/i, section: "Nigerian Content" },
  { match: /\bHSE\b|safety|health|environment/i, section: "HSE" },
  { match: /financ|audit|tax|account/i, section: "Financial" },
  { match: /commercial|pric|quotation|quote/i, section: "Commercial" },
  { match: /technic|personnel|experience|equipment|scope of work/i, section: "Technical" },
];

const OWNER_RULES: { match: RegExp; owner: string }[] = [
  { match: /financ|audit|tax|account/i, owner: "Finance" },
  { match: /\bHSE\b|safety|JHA|hazard/i, owner: "HSE" },
  { match: /nigerian content|NOGIC|NUPRC|NCDMB|\bCO2\b|\bCO7\b/i, owner: "Nigerian Content" },
  { match: /personnel|\bCVs?\b|organogram|HR\b/i, owner: "HR/Operations" },
  { match: /commercial|pric|quotation|quote/i, owner: "Commercial" },
  { match: /technic|equipment|experience/i, owner: "Technical" },
];

function classifyType(text: string): string {
  if (/if (applicable|any|required)|where applicable|where relevant/i.test(text)) return "conditional";
  if (/questionnaire|\bform\b|template|fill in/i.test(text)) return "form";
  if (/\bsign\b|stamp|undertaking|sworn|notariz/i.test(text)) return "action";
  if (/invoice|purchase order|\bPO\b|lease agreement/i.test(text)) return "evidence";
  if (/certificate|registration|license|licence|policy|accounts|clearance|\bCVs?\b|organogram|profile|programme|plan|bond|guarantee/i.test(text)) return "doc";
  if (/experience|contact|information|details|track record/i.test(text)) return "info";
  return "info";
}

function classifyRisk(text: string, type: string): { risk: string; reason: string } {
  if (type === "conditional") return { risk: "conditional", reason: "Applies only under stated conditions — excluded from missing counts." };
  if (/disqualif|reject|no changes|no alteration|must not/i.test(text))
    return { risk: "critical", reason: "Matched disqualification/rejection wording." };
  if (/\bmust\b|\bshall\b|mandatory|required|compulsory/i.test(text))
    return { risk: "mandatory", reason: "Stated with must/shall/required wording." };
  if (/\bmay\b|\bshould\b|recommended|supporting|advantage/i.test(text))
    return { risk: "supporting", reason: "Supporting wording (may/should) — useful but not a bid-killer." };
  return { risk: "mandatory", reason: "Stated as a requirement without explicit criticality." };
}

function suggestOwner(text: string): string | null {
  for (const r of OWNER_RULES) if (r.match.test(text)) return r.owner;
  return null;
}

function cleanTitle(s: string): string {
  return s.replace(/^(please|kindly|tenderers?|bidders?)( must| shall| should)?\s+/i, "").trim().replace(/\s+/g, " ").slice(0, 140);
}

function splitSegments(text: string): string[] {
  return text
    .split(/(?<=[.;])\s+|(?=\b\d+\.\s+[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
}

export function extractRequirements(pages: ParsedPage[]): ExtractedRequirement[] {
  const out: ExtractedRequirement[] = [];
  const seen = new Set<string>();
  let section = "General";

  for (const page of pages) {
    for (const seg of splitSegments(page.text)) {
      for (const st of SECTION_TERMS) {
        if (new RegExp(`^.{0,40}${st.match.source}`, st.match.flags).test(seg)) {
          section = st.section;
          break;
        }
      }

      const entityHits = ENTITIES.filter((e) => e.match.test(seg));
      const obligated = OBLIGATION.test(seg);

      // Year-split: "audited accounts 2022, 2023, 2024"
      const years = /audit/i.test(seg) ? [...seg.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0]) : [];

      if (!obligated && entityHits.length === 0 && years.length === 0) continue;

      const type = classifyType(seg);
      const { risk, reason } = classifyRisk(seg, type);
      const key = seg.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);

      let deliverables: ExtractedDeliverable[];
      if (years.length >= 2) {
        deliverables = [...new Set(years)].map((y) => ({ title: `${y} audited accounts`, expected_detail: seg.slice(0, 120) }));
      } else if (entityHits.length >= 2) {
        deliverables = entityHits.map((e) => ({ title: e.label, expected_detail: seg.slice(0, 120) }));
      } else if (entityHits.length === 1) {
        deliverables = [{ title: entityHits[0].label, expected_detail: seg.slice(0, 120) }];
      } else {
        deliverables = [{ title: cleanTitle(seg).slice(0, 80), expected_detail: seg.slice(0, 120) }];
      }

      out.push({
        section,
        title: cleanTitle(seg),
        description: seg.slice(0, 300),
        type,
        risk,
        risk_reason: reason,
        suggested_owner: suggestOwner(seg),
        source_page: page.page_no,
        source_span: seg.slice(0, 80),
        deliverables,
      });
      if (out.length >= 200) return out;
    }
  }
  return out;
}
