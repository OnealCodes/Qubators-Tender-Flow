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

// Headers, footers, cover lines and glossary definitions are never requirements.
const HEADER_FOOTER = [
  /^invitation to tender provision\b/i,
  /\bES\/NCDMB\//i,
  /\bCW\d{4,}\b.*\d+\s*$/,
  /^page \d+ of \d+$/i,
  /^section [IVXLC]+$/i,
  /^table of contents$/i,
  /^contents$/i,
];

const BIDDER_SUBJECT = /tenderer|contractor|bidder|\byou\b|\byour\b/i;
const COMPANY_ONLY = /^company (will|shall|may|reserves|makes|accepts|monitors)/i;

// Consequence language that makes a sentence a requirement on its own
// ("Failure to X will invalidate your bid"), even without an action verb.
const CRITICAL_STANDALONE =
  /disqualif|invalidat|fatal flaw|will not be considered|will not be evaluated|shall be rejected|will be rejected|grounds for (rejection|disqualification)|may lead to .* not being evaluated|not be evaluated|no acceptance of/i;

const ZONE_HEADERS: { match: RegExp; section: string }[] = [
  { match: /^section\s+A\b|company status/i, section: "General" },
  { match: /^section\s+B\b|corporate structure/i, section: "General" },
  { match: /^section\s+C\b|technical capabilit|equipment and tools|technical questionnaire/i, section: "Technical" },
  { match: /^section\s+D\b|financial capability/i, section: "Financial" },
  { match: /^section\s+E\b|health, safety|hse\b|workers welfare/i, section: "HSE" },
  { match: /nigerian content/i, section: "Nigerian Content" },
  { match: /commercial|schedule of prices|pricing/i, section: "Commercial" },
];

const SECTION_OWNERS: Record<string, string> = {
  Technical: "Technical",
  Financial: "Finance",
  HSE: "HSE",
  "Nigerian Content": "Nigerian Content",
  Commercial: "Commercial",
};

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
  if (/disqualif|invalidat|fatal flaw|will not be considered|will not be evaluated|shall be rejected|will be rejected|grounds for (rejection|disqualification)|may lead to .* not being evaluated|no changes? (to|of)|no alteration/i.test(text))
    return { risk: "critical", reason: "Matched disqualification/rejection wording." };
  if (/reject/i.test(text) && /tender|bid/i.test(text))
    return { risk: "critical", reason: "Rejection tied to the tender/bid itself." };
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

// Boilerplate that is never a requirement: running headers/footers, page
// markers, glossary definitions, TOC lines, dotted leaders.
const SKIP_PATTERNS = [
  /page \d+ of \d+/i,
  /^invitation to tender provision of /i,
  /^(section|contents|table of contents|exhibit|attachment|appendix)\b/i,
  /^\s*(the\s+)?[A-Z][A-Z0-9 \-&,\/()]{3,50}\s+(means|shall mean|refers to|is defined as)\b/,
  /complete table \d+ below/i,
  /\.{5,}|…{2,}/,
  /^CW\d+\s+ES\/NCDMB/i,
  /^[^a-z]*$/,
  // Table header fragments ("S/N JOB TITLE QTY ... YES/NO ... EXPAT ...").
  /^S\/N[\s|]/i,
  /YES\s*\/\s*NO.*YES\s*\/\s*NO/i,
];

export function extractRequirements(pages: ParsedPage[]): ExtractedRequirement[] {
  const out: ExtractedRequirement[] = [];
  const seen = new Set<string>();
  let zone = "General";

  for (const page of pages) {
    for (let seg of splitSegments(page.text)) {
      // Strip leading page numbers ("35 VERY IMPORTANT...").
      seg = seg.replace(/^\d{1,3}\s+(?=[A-Z•])/, "").trim();
      if (seg.length < 20) continue;

      // Zone headers set the section for everything that follows them.
      // Checked before boilerplate skips (zone lines look like headers).
      const zoneHit = ZONE_HEADERS.find((z) => z.match.test(seg.slice(0, 120)));
      if (zoneHit) zone = zoneHit.section;

      if (SKIP_PATTERNS.some((p) => p.test(seg))) continue;
      if (HEADER_FOOTER.some((p) => p.test(seg))) continue;
      if (COMPANY_ONLY.test(seg)) continue;

      const entityHits = ENTITIES.filter((e) => e.match.test(seg));
      const obligated = OBLIGATION.test(seg);
      const bidderDirected = BIDDER_SUBJECT.test(seg);

      // Year-split: "audited accounts 2022, 2023, 2024" / "Tax Clearance 2022–2024".
      const yearHay = /audit|tax clearance/i.test(seg) ? seg : "";
      const years = yearHay ? [...new Set([...yearHay.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0]))] : [];

      // Candidacy: bidder-directed obligations, known entities, year sets,
      // or standalone critical consequence statements.
      if (!bidderDirected && entityHits.length === 0 && years.length === 0 && !CRITICAL_STANDALONE.test(seg)) continue;
      if (!obligated && entityHits.length === 0 && years.length === 0 && !CRITICAL_STANDALONE.test(seg)) continue;

      const section = (() => {
        for (const st of SECTION_TERMS) {
          if (new RegExp(`^.{0,40}${st.match.source}`, st.match.flags).test(seg)) return st.section;
        }
        return zone;
      })();

      const type = classifyType(seg);
      const { risk, reason } = classifyRisk(seg, type);
      const key = seg.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);

      const yearNoun = /tax clearance/i.test(seg) ? "Tax clearance" : "audited accounts";
      let deliverables: ExtractedDeliverable[];
      if (years.length >= 2) {
        deliverables = years.map((y) => ({ title: `${y} ${yearNoun}`, expected_detail: seg.slice(0, 120) }));
      } else if (entityHits.length >= 2) {
        deliverables = entityHits.map((e) => ({ title: e.label, expected_detail: seg.slice(0, 120) }));
      } else if (entityHits.length === 1) {
        deliverables = [{ title: entityHits[0].label, expected_detail: seg.slice(0, 120) }];
      } else {
        deliverables = [{ title: cleanTitle(seg).slice(0, 80), expected_detail: seg.slice(0, 120) }];
      }

      const suggested = suggestOwner(seg) ?? SECTION_OWNERS[section] ?? null;
      out.push({
        section,
        title: cleanTitle(seg),
        description: seg.slice(0, 300),
        type,
        risk,
        risk_reason: reason,
        suggested_owner: suggested,
        source_page: page.page_no,
        source_span: seg.slice(0, 80),
        deliverables,
      });
      if (out.length >= 400) return out;
    }
  }
  return out;
}
