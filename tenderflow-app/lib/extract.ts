// Heuristic requirement extractor v2 — bid-zone aware.
// Splits the tender the way a bid manager reads it:
//   - WHAT TO SUBMIT NOW (Mandatory Bid Content, pricing schedule) → matrix
//   - POST-AWARD execution clauses → counted and set aside, never in the matrix
//   - EVALUATION CRITERIA → weights captured (drive risk), not requirements
// Envelopes: Technical vs Commercial. Returns rows + run meta.

import type { ParsedPage } from "./pdf";

export interface ExtractedDeliverable {
  title: string;
  expected_detail: string;
}

export interface ExtractedRequirement {
  section: string;
  envelope: "Technical" | "Commercial";
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

export interface ExtractionMeta {
  weights: { criterion: string; weight: string }[];
  skipped_post_award: number;
  skipped_evaluation: number;
  greatest_weight_note: string | null;
}

const OBLIGATION = /\b(provide|submit|complete|sign|ensure|include|attach|demonstrate|quote|present|furnish|supply|undertake|maintain|obtain|price)\b/i;

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

// ---- bid zones: what the text is FOR ----
type ZoneKind = "general" | "bid" | "commercial" | "evaluation" | "execution";

const ZONE_SETTERS: { match: RegExp; zone: ZoneKind }[] = [
  { match: /mandatory bid content|minimum bid content|bid submission shall|what to submit|documents to be submitted/i, zone: "bid" },
  { match: /pricing schedule|price schedule|schedule of prices|price basis|scope group/i, zone: "commercial" },
  { match: /evaluation criteria|bids will be evaluated|basis of award|scored separat/i, zone: "evaluation" },
  { match: /post-award|after award|upon award|contract execution|during execution|during the works|following award/i, zone: "execution" },
];

// A new numbered tender section resets transient zones (bid content and
// commercial lists end where the next numbered section begins).
const SECTION_RESET = /^\d+(\.\d+)*\s+[A-Z0-9]/;

const POST_AWARD_SIGNALS = /after award|post-award|upon award|following award|during execution|during the works|after (contract|job) (award|completion)|at completion|applicable to the work/i;
const SUBMISSION_SIGNALS = /submit|bid|proposal|tender|with (the|this) bid|at (bid|tender) (submission|closing)/i;

const ZONE_HEADERS: { match: RegExp; section: string }[] = [
  { match: /^section\s+A\b|company status/i, section: "General" },
  { match: /^section\s+B\b|corporate structure/i, section: "General" },
  { match: /^section\s+C\b|technical capabilit|equipment and tools|technical questionnaire/i, section: "Technical" },
  { match: /^section\s+D\b|financial capability/i, section: "Financial" },
  { match: /^section\s+E\b|health, safety|hse\b|workers welfare/i, section: "HSE" },
  { match: /nigerian content/i, section: "Nigerian Content" },
  { match: /tender requirements|mandatory bid content/i, section: "Technical" },
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
  { match: /method statement/i, label: "Method statement" },
  { match: /deviation register/i, label: "Deviation register" },
  { match: /reference projects?/i, label: "Reference projects" },
  { match: /nigerian content plan/i, label: "Nigerian Content Plan" },
  { match: /quality plan/i, label: "Quality plan" },
  { match: /schedule/i, label: "Schedule" },
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
  { match: /method statement|software|analysis|schedule|deviation/i, owner: "Technical" },
  { match: /technic|equipment|experience/i, owner: "Technical" },
];

function classifyType(text: string): string {
  if (/if (applicable|any|required)|where applicable|where relevant/i.test(text)) return "conditional";
  if (/questionnaire|\bform\b|template|fill in/i.test(text)) return "form";
  if (/\bsign\b|stamp|undertaking|sworn|notariz/i.test(text)) return "action";
  if (/invoice|purchase order|\bPO\b|lease agreement/i.test(text)) return "evidence";
  if (/certificate|registration|license|licence|policy|accounts|clearance|\bCVs?\b|organogram|profile|programme|plan|bond|guarantee|statement|register|schedule/i.test(text)) return "doc";
  if (/experience|contact|information|details|track record/i.test(text)) return "info";
  return "info";
}

function classifyRisk(text: string, type: string, listedContent: boolean): { risk: string; reason: string } {
  if (type === "conditional") return { risk: "conditional", reason: "Applies only under stated conditions — excluded from missing counts." };
  if (/disqualif|invalidat|fatal flaw|will not be considered|will not be evaluated|shall be rejected|will be rejected|grounds for (rejection|disqualification)|may lead to .* not being evaluated|no changes? (to|of)|no alteration/i.test(text))
    return { risk: "critical", reason: "Matched disqualification/rejection wording." };
  if (/reject/i.test(text) && /tender|bid/i.test(text))
    return { risk: "critical", reason: "Rejection tied to the tender/bid itself." };
  // Legal boilerplate states context, not actions: keep the row (recall)
  // but don't let it inflate mandatory counts (precision). Checked before
  // must/shall because boilerplate itself uses those modals ("shall neither
  // be construed"). Pattern kept tight to avoid catching real obligations.
  if (/construed as|\bdefinition|\binterpretation|governing law|entire agreement|\bheadings?\b|notice address|address for notices/i.test(text))
    return { risk: "supporting", reason: "Legal/interpretive context — kept for completeness, not a core action." };
  // Listed bid content outranks generic must/shall: the client put it in the
  // Mandatory Bid Content list, so it is mandatory by placement.
  if (listedContent)
    return { risk: "mandatory", reason: "Listed in Mandatory Bid Content." };
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
  return s
    .replace(/^[•\-\*▪◦‣·]\s*/, "")
    .replace(/^\(\w+\)\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^(please|kindly|tenderers?|bidders?)( must| shall| should)?\s+/i, "")
    .trim().replace(/\s+/g, " ").slice(0, 140);
}

function splitSegments(text: string): string[] {
  return text
    .split(/(?<=[.;])\s+|(?=\b\d+\.\s+[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
}

function isBullet(seg: string): boolean {
  return /^[•\-\*▪◦‣·]\s+|^\(\w+\)\s+|^\d+[.)]\s+[A-Z]/.test(seg);
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
  // Bare intros ending in a colon ("Bidders must submit:") — the bullets
  // that follow carry the actual requirements.
  /^[^:]{3,60}:\s*$/,
];

// Pricing-schedule row: "Group A ... Lump sum", "Option 1 ... Day rate".
// Table headers sometimes ride along ("Item Scope Price basis Group A ...").
const PRICING_ROW = /^(?:Item\s+Scope\s+Price\s+basis\s+)?(Group\s+[A-E]|Option\s*\d+|Rates)\b\s*(.{0,160}?)\s*(Lump sum(?:,?\s*itemised separately)?|Day rate|Rates?)\s*\.?\s*$/i;

const WEIGHT_ROW = /([A-Za-z][^.%•\n]{3,70}?)\s+(\d{1,3})\s*%/;

export function extractRequirements(pages: ParsedPage[]): { requirements: ExtractedRequirement[]; meta: ExtractionMeta } {
  const out: ExtractedRequirement[] = [];
  const meta: ExtractionMeta = { weights: [], skipped_post_award: 0, skipped_evaluation: 0, greatest_weight_note: null };
  const seen = new Set<string>();
  const seenWeights = new Set<string>();
  let zone = "General";
  let kind: ZoneKind = "general";
  let pricingParent: ExtractedRequirement | null = null;

  const push = (req: ExtractedRequirement) => {
    const key = req.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(req);
  };

  for (const page of pages) {
    for (let seg of splitSegments(page.text)) {
      // Strip leading page numbers ("35 VERY IMPORTANT...").
      seg = seg.replace(/^\d{1,3}\s+(?=[A-Z•])/, "").trim();
      if (seg.length < 20) continue;

      const head = seg.slice(0, 120);

      // Zone headers steer everything below them; a fresh numbered tender
      // section resets back to general reading. Only short header-like
      // segments skip — long sentences mentioning a zone phrase still flow
      // through (the post-award gate counts them, evaluation captures them).
      const zoneSet = ZONE_SETTERS.find((z) => z.match.test(head));
      if (zoneSet) {
        kind = zoneSet.zone;
        // Table-prefixed pricing rows ("Item Scope Price basis Group A ...
        // Lump sum") set the zone but still flow through to the pricing
        // branch below instead of skipping as headers.
        if (seg.length < 80 && !PRICING_ROW.test(seg)) continue;
      } else if (SECTION_RESET.test(seg.slice(0, 30)) && !/tender requirements|evaluation|pricing/i.test(head)) {
        kind = "general";
      }

      const zoneHit = ZONE_HEADERS.find((z) => z.match.test(head));
      if (zoneHit) zone = zoneHit.section;

      if (SKIP_PATTERNS.some((p) => p.test(seg))) continue;
      if (HEADER_FOOTER.some((p) => p.test(seg))) continue;
      if (COMPANY_ONLY.test(seg)) continue;

      // Evaluation zone: capture weights, skip as requirements.
      if (kind === "evaluation") {
        const wm = seg.match(WEIGHT_ROW);
        if (wm) {
          const wkey = `${wm[1].trim()}|${wm[2]}`;
          if (!seenWeights.has(wkey)) {
            seenWeights.add(wkey);
            meta.weights.push({ criterion: wm[1].trim(), weight: `${wm[2]}%` });
          }
        }
        if (/greatest weight/i.test(seg)) meta.greatest_weight_note = seg.slice(0, 160);
        meta.skipped_evaluation++;
        continue;
      }

      // Post-award gate: execution clauses are set aside, never matrix rows.
      if (kind === "execution" || (POST_AWARD_SIGNALS.test(seg) && !SUBMISSION_SIGNALS.test(seg))) {
        meta.skipped_post_award++;
        continue;
      }

      // Pricing-schedule rows become Commercial deliverables under one parent.
      const pricing = seg.match(PRICING_ROW);
      if (pricing && (kind === "commercial" || /lump sum|day rate/i.test(seg))) {
        if (!pricingParent || pricingParent.source_page !== page.page_no) {
          pricingParent = {
            section: "Commercial",
            envelope: "Commercial",
            title: "Pricing Schedule — price by scope group",
            description: "Bidders shall price by scope group; optional items priced separately.",
            type: "form",
            risk: "critical",
            risk_reason: "Pricing completeness is scored — missing groups risk disqualification.",
            suggested_owner: "Commercial",
            source_page: page.page_no,
            source_span: seg.slice(0, 80),
            deliverables: [],
          };
          push(pricingParent);
        }
        pricingParent.deliverables.push({
          title: `Price ${pricing[1].trim()} — ${(pricing[2] || "").trim()}`.slice(0, 100),
          expected_detail: `Price basis: ${pricing[3].trim()}`,
        });
        continue;
      }

      const bullet = isBullet(seg);
      const listedContent = bullet && (kind === "bid" || kind === "commercial");
      const entityHits = ENTITIES.filter((e) => e.match.test(seg));
      const obligated = OBLIGATION.test(seg);
      const bidderDirected = BIDDER_SUBJECT.test(seg);

      // Year-split: "audited accounts 2022, 2023, 2024" / "Tax Clearance 2022–2024".
      const yearHay = /audit|tax clearance/i.test(seg) ? seg : "";
      const years = yearHay ? [...new Set([...yearHay.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0]))] : [];

      // Candidacy: bidder-directed obligations, known entities, year sets,
      // standalone critical consequences — or a listed bullet in a bid zone
      // ("Method statement per Section 2.21." has no verb but IS the bid).
      if (!bidderDirected && entityHits.length === 0 && years.length === 0 && !CRITICAL_STANDALONE.test(seg) && !listedContent) continue;
      if (!obligated && entityHits.length === 0 && years.length === 0 && !CRITICAL_STANDALONE.test(seg) && !listedContent) continue;

      const section = (() => {
        for (const st of SECTION_TERMS) {
          if (new RegExp(`^.{0,40}${st.match.source}`, st.match.flags).test(seg)) return st.section;
        }
        return zone;
      })();
      // Commercial envelope only when the row itself is commercial: a
      // pricing-table mention must not repaint neighbouring Technical rows
      // (e.g. quality plan, schedule) as Commercial.
      const commercialRow = section === "Commercial" || /pric|price|payment|budget|scope group|\bGroup\s+[A-E]\b|Option\s*\d+/i.test(seg);
      const envelope: "Technical" | "Commercial" = commercialRow ? "Commercial" : "Technical";

      const type = classifyType(seg);
      const { risk, reason } = classifyRisk(seg, type, listedContent);
      // Dedupe happens once, inside push() (title key) — pricing parents
      // share the same path so re-runs stay idempotent.

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
      push({
        section,
        envelope,
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
      if (out.length >= 400) return { requirements: out, meta };
    }
  }

  // Weighted evaluation focus (e.g. Sections 2.9/2.10/2.11 carry the greatest
  // weight) upgrades matching requirements to critical.
  if (meta.greatest_weight_note) {
    const focus = [...meta.greatest_weight_note.matchAll(/\b2\.\d{1,2}\b/g)].map((m) => m[0]);
    if (focus.length) {
      for (const r of out) {
        if (r.risk === "critical") continue;
        const hit = focus.find((f) => r.description.includes(f));
        if (hit) {
          r.risk = "critical";
          r.risk_reason = `Evaluation focus: Section ${hit} carries the greatest technical weight.`;
        }
      }
    }
  }

  return { requirements: out, meta };
}
