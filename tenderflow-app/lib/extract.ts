// Heuristic requirement extractor v3 — grouped, exact-wording rows.
// One meaningful tender requirement = one matrix row:
//   - numbered structure parsed (4.1, 1.4.1) and kept as `ref`
//   - title = EXACT tender wording (bullet markers/numbers stripped only)
//   - supporting sentences/bullets join the row's detail block, never new rows
//   - deliverables only for genuinely distinct collectables (never echoes)
//   - owner stays NULL until a human accepts (suggestion kept separate)
// Zones/envelopes/post-award gate/eval weights/pricing rows as in v2.

import type { ParsedPage } from "./pdf";

export interface ExtractedDeliverable {
  title: string;
  expected_detail: string;
}

export interface ExtractedRequirement {
  ref: string | null;
  section: string;
  envelope: "Technical" | "Commercial";
  kind: string;
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
  // Commercial first: it is more specific than the general bid patterns
  // ("COMMERCIAL RFQ SHOULD INCLUDE" contains "SHOULD INCLUDE").
  { match: /pricing schedule|price schedule|schedule of prices|price basis|scope group|commercial RFQ should include|commercial.*should include/i, zone: "commercial" },
  { match: /mandatory bid content|minimum bid content|bid submission shall|bid submission requirement|what to submit|documents to be submitted|should include/i, zone: "bid" },
  { match: /evaluation criteria|bids will be evaluated|basis of award|scored separat/i, zone: "evaluation" },
  { match: /post-award|after award|upon award|contract execution|during execution|during the works|following award/i, zone: "execution" },
];

// A new numbered tender section resets transient zones (bid content and
// commercial lists end where the next numbered section begins).
const SECTION_RESET = /^\d+(\.\d+)*\s+[A-Z0-9]/;

// Numbered tender reference: "4.1 Mandatory Bid Content", "1.4.2 ...".
const REF_HEADER = /^(\d+(?:\.\d+)+)\s+([A-Z].{2,100}?)\s*$/;

const POST_AWARD_SIGNALS = /after award|post-award|upon award|following award|during execution|during the works|after (contract|job) (award|completion)|at completion|applicable to the work/i;
const SUBMISSION_SIGNALS = /submit|bid|proposal|tender|with (the|this) bid|at (bid|tender) (submission|closing)/i;
// Performance-of-work language ("supply diligently ... in accordance with
// the contract") describes execution, not submission — unless the sentence
// itself ties to the bid.
const WORK_PERFORMANCE = /supply .* diligently|good and professional manner|contractor shall .* in accordance with the (contract|scope|work)|employ (his|their) best efforts|good care and professional judgment|professional and timely manner/i;

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
  { match: /work execution plan|project schedule|work schedule|critical path|schedule of (rates|prices)/i, label: "Schedule" },
];

const SECTION_TERMS: { match: RegExp; section: string }[] = [
  { match: /technic|personnel|experience|equipment|scope of work|analysis|assessment|design|strength|fatigue|software|model|schedule/i, section: "Technical" },
  { match: /nigerian content|local content/i, section: "Nigerian Content" },
  { match: /\bHSE\b|safety|health|environment/i, section: "HSE" },
  { match: /financ|audit|tax|account/i, section: "Financial" },
  { match: /commercial|pric|quotation|quote/i, section: "Commercial" },
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
  if (/certificate|registration|license|licence|policy|accounts|clearance|\bCVs?\b|organogram|profile|programme|plan|bond|guarantee|statement|register|\bschedule\b/i.test(text)) return "doc";
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

export function suggestOwner(text: string): string | null {
  for (const r of OWNER_RULES) if (r.match.test(text)) return r.owner;
  return null;
}

// Strip list markers and section numbers only — the wording itself stays
// EXACTLY as the tender wrote it (no paraphrase, no shortening).
function cleanTitle(s: string): string {
  return s
    .replace(/^[•\-\*▪◦‣·]\s*/, "")
    .replace(/^\(\w+\)\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim().replace(/\s+/g, " ").slice(0, 500);
}

function splitSegments(text: string): string[] {
  // Bullets are structural: split them out but keep the marker so each
  // bullet reads as its own candidate ("4.1 Mandatory Bid Content" stays a
  // header; "• Method statement ..." becomes its own row).
  const withBullets = text
    .split(/(\s*•\s*)/)
    .reduce<string[]>((acc, part, i, arr) => {
      if (/^\s*•\s*$/.test(part)) return acc;
      const prev = arr[i - 1] ?? "";
      acc.push(/^\s*•\s*$/.test(prev) ? `• ${part.trim()}` : part);
      return acc;
    }, [])
    .join("\n");
  return withBullets
    // Never split after abbreviations (i.e. / e.g. / etc. / Sec. / No. /
    // Fig. / vs.) — splitting there shreds years and references ("i.e.
    // 2023 - 2025" must stay whole). Exception: an ALL-CAPS header follows
    // ("etc. COMMERCIAL RFQ SHOULD INCLUDE:") — glued headers always split
    // off, otherwise they repaint the preceding bullet's envelope.
    .split(/(?<=[.;])(?<!\b(?:i\.e|e\.g|etc|Sec|No|Fig|vs)\.)\s+|\n|(?<=[.;])\s+(?=[A-Z][A-Z \-&/,]{3,}:)|(?=\b\d+\.\s+[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
}

function isBullet(seg: string): boolean {
  return /^[•\-\*▪◦‣·]\s+|^\(\w+\)\s+|^\d+[.)]\s+[A-Z]/.test(seg);
}

// Boilerplate that is never a requirement: running headers/footers, page
// markers, glossary definitions, TOC lines, dotted leaders, bare intros.
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
  // Bare scope/introduction openers ("INTRODUCTION Damas ...", "SCOPE OF
  // WORK FOR ... GENERAL ...") — preamble narratives, never requirements.
  // Numbered variants ("2.1 Scope of Work: ...") are unaffected: they start
  // with digits, and genuine requirements live in numbered/bid sections.
  /^(introduction|scope of work|project scope|project background|background|overview)\b/i,
];

// Table-of-contents lines name every section ("4.3 Evaluation Criteria 18")
// without meaning any of them — they must set no state at all.
const TOC_ENTRY = /\.{4,}|^\d+(\.\d+)*\s+[A-Z].*\s+\d{1,3}$/;
// Pricing-schedule row: "Group A ... Lump sum", "Option 1 ... Day rate".
// Table headers sometimes ride along ("Item Scope Price basis Group A ...").
const PRICING_ROW = /^(?:Item\s+Scope\s+Price\s+basis\s+)?(Group\s+[A-E]|Option\s*\d+|Rates)\b\s*(.{0,160}?)\s*(Lump sum(?:,?\s*itemised separately)?|Day rate|Rates?)\s*\.?\s*$/i;

const WEIGHT_ROW = /([A-Za-z][^.%•\n]{3,70}?)\s+(\d{1,3})\s*%/;

interface OpenGroup {
  ref: string | null;
  section: string;
  envelope: "Technical" | "Commercial";
  segments: { text: string; page: number }[];
  page: number;
  zone: ZoneKind;
  listedContent: boolean;
}

export function extractRequirements(pages: ParsedPage[]): { requirements: ExtractedRequirement[]; meta: ExtractionMeta } {
  const out: ExtractedRequirement[] = [];
  const meta: ExtractionMeta = { weights: [], skipped_post_award: 0, skipped_evaluation: 0, greatest_weight_note: null };
  const seen = new Set<string>();
  const seenWeights = new Set<string>();
  let zone = "General";
  let kind: ZoneKind = "general";
  let refContext: string | null = null;
  let pricingParent: ExtractedRequirement | null = null;
  let group: OpenGroup | null = null;
  // True when the commercial zone came from a SHOULD-INCLUDE list header
  // (broad context: rows below belong to the commercial submission) rather
  // than a pricing-table mention (narrow: only pricing rows are commercial).
  let commercialList = false;
  // Skip-zones (execution, evaluation) expire: a single short header must
  // never repaint the rest of the document when no reset follows it.
  let zoneTtl = 0;

  const push = (req: ExtractedRequirement) => {
    const key = `${req.ref ?? ""}|${req.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(req);
  };

  const sectionFor = (seg: string): string => {
    for (const st of SECTION_TERMS) {
      if (new RegExp(`^.{0,40}${st.match.source}`, st.match.flags).test(seg)) return st.section;
    }
    return zone;
  };

  const qualifies = (seg: string, listed: boolean): boolean => {
    const entityHits = ENTITIES.filter((e) => e.match.test(seg));
    const yearHay = /audit|tax clearance/i.test(seg) ? seg : "";
    const years = yearHay ? [...yearHay.matchAll(/\b(19|20)\d{2}\b/g)] : [];
    return (
      (BIDDER_SUBJECT.test(seg) && OBLIGATION.test(seg)) ||
      entityHits.length > 0 ||
      years.length > 0 ||
      CRITICAL_STANDALONE.test(seg) ||
      listed
    );
  };

  const closeGroup = () => {
    if (!group || group.segments.length === 0) {
      group = null;
      return;
    }
    if (process.env.TF_DBG) {
      console.error(`DBG close kind=${group.envelope} zkind=${group.zone} segs=${group.segments.length} first=${group.segments[0].text.slice(0, 50)}`);
    }
    const joined = group.segments.map((s) => s.text).join(" ");
    const first = group.segments[0].text;
    const type = classifyType(joined);
    const { risk, reason } = classifyRisk(joined, type, group.listedContent);

    // Distinct collectables only: entity splits and year splits. A single
    // entity or none means the row stands alone — never an echo row.
    const entityHits = ENTITIES.filter((e) => e.match.test(joined));
    const yearHay = /audit|tax clearance/i.test(joined) ? joined : "";
    const years = [...new Set([...yearHay.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0]))];
    const yearNoun = /tax clearance/i.test(joined) ? "Tax clearance" : "audited accounts";
    let deliverables: ExtractedDeliverable[];
    if (years.length >= 2) {
      deliverables = years.map((y) => ({ title: `${y} ${yearNoun}`, expected_detail: joined.slice(0, 120) }));
    } else if (entityHits.length >= 2) {
      const labels = [...new Set(entityHits.map((e) => e.label))];
      if (labels.length >= 2) {
        deliverables = labels.map((label) => ({ title: label, expected_detail: joined.slice(0, 120) }));
      } else {
        deliverables = [];
      }
    } else {
      deliverables = [];
    }

    const kind: string =
      type === "conditional" ? "condition"
      : group.envelope === "Commercial" ? "commercial"
      : "requirement";
    const suggested = suggestOwner(joined) ?? SECTION_OWNERS[group.section] ?? null;
    push({
      ref: group.ref,
      section: group.section,
      envelope: group.envelope,
      kind,
      title: cleanTitle(first),
      description: group.segments.map((s) => s.text).join(" ").slice(0, 1200),
      type,
      risk,
      risk_reason: reason,
      suggested_owner: suggested,
      source_page: group.page,
      source_span: first.slice(0, 80),
      deliverables,
    });
    group = null;
  };

  for (const page of pages) {
    // Page breaks reset the volatile zones: a SHOULD-INCLUDE header on one
    // page must not repaint the next page's rows (TOC fragments and
    // multi-column reading order routinely strand them). The broad bid zone
    // stays sticky so multi-page bid lists keep working.
    if (kind === "commercial" || kind === "execution" || kind === "evaluation") {
      closeGroup();
      kind = "general";
      commercialList = false;
    }
    // Strip running page headers first ("Document No. ... Page 20 of 21"):
    // otherwise they glue onto the section header that follows and the
    // whole segment gets skipped as a page marker — taking the section
    // context (and its bullets) down with it.
    const cleanText = page.text.replace(/^[\s\S]*?Document No\.[\s\S]*?Page \d+ of \d+\s*/i, "");
    for (let seg of splitSegments(cleanText)) {
      // Strip leading page numbers ("35 VERY IMPORTANT...").
      seg = seg.replace(/^\d{1,3}\s+(?=[A-Z•])/, "").trim();
      if (seg.length < 20) continue;
      // TOC lines name sections without meaning them — no state changes.
      if (TOC_ENTRY.test(seg)) continue;

      let head = seg.slice(0, 120);

      // Numbered tender reference ("4.1 Mandatory Bid Content"): sets the
      // ref context for everything below it. A bare header line is
      // structure, not a requirement; a header with content trailing after
      // it ("4.1 Mandatory Bid Content • Method statement ...") keeps its
      // ref and flows on as content.
      const refHit = seg.match(REF_HEADER);
      if (refHit && seg.length < 160) {
        closeGroup();
        refContext = refHit[1];
        // A header can trail a deeper ref ("4.0 TENDER REQUIREMENTS 4.1
        // Mandatory Bid Content"): the LAST ref wins as context.
        const trailing = [...seg.matchAll(/(?:^|\s)(\d+\.\d+(?:\.\d+)*)\s+(?=[A-Z])/g)].map((m) => m[1]);
        if (trailing.length > 0) refContext = trailing[trailing.length - 1];
        const zoneHit0 = ZONE_HEADERS.find((z) => z.match.test(head));
        if (zoneHit0) zone = zoneHit0.section;
        const zoneSet0 = ZONE_SETTERS.find((z) => z.match.test(head));
        if (zoneSet0 && kind !== zoneSet0.zone) {
          kind = zoneSet0.zone;
          zoneTtl = zoneSet0.zone === "execution" ? 5 : zoneSet0.zone === "evaluation" ? 10 : 0;
        }
        continue;
      }
      const refPrefix = seg.match(/^(\d+(?:\.\d+)+)\s+(?=[A-Z•])/);
      if (refPrefix) {
        closeGroup();
        refContext = refPrefix[1];
        seg = seg.slice(refPrefix[0].length).trim();
        head = seg.slice(0, 120);
        const zoneHit0 = ZONE_HEADERS.find((z) => z.match.test(head));
        if (zoneHit0) zone = zoneHit0.section;
        const zoneSet0 = ZONE_SETTERS.find((z) => z.match.test(head));
        if (zoneSet0 && kind !== zoneSet0.zone) {
          kind = zoneSet0.zone;
          zoneTtl = zoneSet0.zone === "execution" ? 5 : zoneSet0.zone === "evaluation" ? 10 : 0;
        }
        if (seg.length < 20) continue;
      }
      // Numbered refs can also sit mid-segment ("4.0 TENDER REQUIREMENTS
      // 4.1 Mandatory Bid Content • Method ..."): the LAST one wins as the
      // context — but only in short header-like segments, so body
      // cross-references ("see Section 4.3") can't hijack it.
      const midRefs = seg.length < 160 ? [...seg.matchAll(/(?:^|\s)(\d+\.\d+(?:\.\d+)*)\s+(?=[A-Z])/g)].map((m) => m[1]) : [];
      if (midRefs.length > 0) {
        closeGroup();
        refContext = midRefs[midRefs.length - 1];
      }

      // Zone headers steer everything below them; a fresh numbered tender
      // section resets back to general reading. Flips apply at any length
      // (headers arrive glued to content); only the SKIP is length-gated.
      // Segment-grounded envelope/type rules plus skip-zone TTLs keep long
      // body mentions from repainting the rest of the document.
      const zoneSet = ZONE_SETTERS.find((z) => z.match.test(head));
      let zoneJustSet = false;
      if (zoneSet) {
        if (kind !== zoneSet.zone) {
          closeGroup();
          kind = zoneSet.zone;
          zoneJustSet = true;
        }
        // Refresh on every matching header, not just on change: repeated
        // headers re-arm skip-zone TTLs and record how the commercial zone
        // was entered (list header vs pricing-table mention).
        if (zoneSet.zone === "execution") zoneTtl = 5;
        else if (zoneSet.zone === "evaluation") zoneTtl = 10;
        if (zoneSet.zone === "commercial") commercialList = /should include/i.test(head);
        if (seg.length < 80 && !PRICING_ROW.test(seg)) continue;
      } else if (!zoneSet && SECTION_RESET.test(seg.slice(0, 30)) && !/tender requirements|evaluation|pricing/i.test(head)) {
        if (kind !== "general") {
          closeGroup();
          kind = "general";
          commercialList = false;
        }
      }
      // Expire skip-zones: content far below a short header reads normally.
      if (!zoneJustSet && (kind === "execution" || kind === "evaluation")) {
        zoneTtl--;
        if (zoneTtl <= 0) {
          closeGroup();
          kind = "general";
        }
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
      if (
        kind === "execution" ||
        (POST_AWARD_SIGNALS.test(seg) && !SUBMISSION_SIGNALS.test(seg)) ||
        (WORK_PERFORMANCE.test(seg) && !SUBMISSION_SIGNALS.test(seg))
      ) {
        if (group && (group.page !== page.page_no || group.zone !== kind)) closeGroup();
        meta.skipped_post_award++;
        continue;
      }

      // Pricing-schedule rows become Commercial deliverables under a single
      // parent per run (ref = current numbered context). The stored object
      // is mutated, so later pages append to the same row.
      const pricing = seg.match(PRICING_ROW);
      if (pricing && (kind === "commercial" || /lump sum|day rate/i.test(seg))) {
        closeGroup();
        if (!pricingParent) {
          pricingParent = {
            ref: refContext,
            section: "Commercial",
            envelope: "Commercial",
            kind: "commercial",
            title: "Pricing Schedule — price by scope group",
            description: "Bidders shall price by scope group; optional items priced separately and excluded from the base total.",
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
      const section = sectionFor(seg);
      // Commercial envelope when the row's own words say so, or when it sits
      // under a SHOULD-INCLUDE commercial list (broad context). A bare
      // pricing-table mention must not repaint neighbouring Technical rows
      // such as quality plans or schedules as Commercial.
      const commercialRow =
        /pric|price|payment|budget|scope group|quote|quotation|commercial|bid bond|\bGroup\s+[A-E]\b|Option\s*\d+/i.test(seg) ||
        (kind === "commercial" && commercialList);
      const envelope: "Technical" | "Commercial" = commercialRow ? "Commercial" : "Technical";

      // Group boundaries: new bullet, zone change, page change, or a long
      // run — related sentences stay together inside one requirement.
      if (group && (bullet || group.zone !== kind || group.page !== page.page_no || group.segments.length >= 4)) {
        closeGroup();
      }

      if (!qualifies(seg, listedContent)) {
        // Non-qualifying sentences join the open group as supporting detail
        // (qualifications, exclusions, conditions) — never standalone rows.
        if (group && group.page === page.page_no && group.zone === kind && group.segments.length < 6) {
          group.segments.push({ text: seg, page: page.page_no });
        }
        continue;
      }

      if (!group) {
        group = {
          ref: refContext,
          section,
          envelope,
          segments: [],
          page: page.page_no,
          zone: kind,
          listedContent,
        };
      }
      group.segments.push({ text: seg, page: page.page_no });
      group.listedContent = group.listedContent || listedContent;
      if (out.length + 1 >= 400) {
        closeGroup();
        return { requirements: out, meta };
      }
    }
    closeGroup();
  }
  closeGroup();

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
