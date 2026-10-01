// Phase 2a: deterministic section chunker + document map.
// Pure functions only — no AI, no database, no network.
// Purpose: long tenders are mostly post-award contract text. The map lets
// later phases send only bid-stage chunks to Gemini, while flagging
// post-award chunks that hide a bid-stage submission clause.

import type { ParsedPage } from "./pdf";

export type ChunkSource = "numbered" | "heading" | "page";

export type ChunkZone =
  | "bid-instructions"
  | "forms"
  | "commercial"
  | "contract-scope"
  | "appendix";

export interface ChunkHeader {
  ref: string | null;
  title: string;
  page: number;
}

export interface SectionChunk {
  id: string;
  ref: string | null;
  title: string;
  startPage: number;
  endPage: number;
  /** Core pages only — the union over all chunks covers every page exactly once. */
  text: string;
  /** Core text plus one neighbour page each side (marked), for split bullets/tables. */
  textWithOverlap: string;
  overlapPages: number[];
  pageCount: number;
  charCount: number;
  source: ChunkSource;
  headers: ChunkHeader[];
}

/** Long sections split into parts of at most this many pages. No char cap. */
export const MAX_CHUNK_PAGES = 20;
/** Last-resort window when a tender has no detectable headings at all. */
export const PAGE_FALLBACK_SIZE = 5;

// Same numbered-header pattern as collectHeaders (copied, not imported, to
// keep this module free of database/network dependencies).
const NUMBERED_RE = /(\d+\.\d+(?:\.\d+)*)\s+([A-Z][A-Za-z][A-Za-z &,\-]{2,60}?)(?=\s*(?:•|\.|$|\d+\.\d+))/g;

// Fallback heading styles for tenders with no x.y headers (e.g. RFQs):
// single-level numbers ("5. RFQ BID SUBMISSION REQUIREMENT"), colon
// terminated caps ("TECHNICAL RFQ SHOULD INCLUDE:") and exhibits.
const SINGLE_LEVEL_RE = /(?:^|\s)(\d+)\.\s+([A-Z][A-Za-z]*(?:\s+[A-Za-z&\-–()\/,]+){0,6})/g;
const CAPS_HEADING_RE = /([A-Z][A-Z0-9 \-&\/,()]{6,70}?)\s*:/g;
const EXHIBIT_RE = /((?:Appendix|Exhibit|Attachment|Annex)\s+[A-Z0-9]+[^.]{0,60}?)(?=\s*(?:•|:|$|\d))/gi;

function numberedHeadersOn(page: { page_no: number; text: string }): ChunkHeader[] {
  const out: ChunkHeader[] = [];
  NUMBERED_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMBERED_RE.exec(page.text)) !== null) {
    const ref = m[1];
    const title = m[2].trim();
    const after = page.text.slice(NUMBERED_RE.lastIndex, NUMBERED_RE.lastIndex + 12);
    if (/^\s*\.{2,}/.test(after)) continue; // TOC dotted leaders
    if (/\.{3,}/.test(title)) continue;
    out.push({ ref, title, page: page.page_no });
    if (out.length >= 40) break;
  }
  return out;
}

function headingFallbackOn(page: { page_no: number; text: string }): ChunkHeader[] {
  const out: ChunkHeader[] = [];
  const seen = new Set<string>();
  const push = (ref: string | null, title: string) => {
    const t = title.trim().replace(/\s+/g, " ");
    if (t.length < 8 || /\.{4,}/.test(t)) return; // TOC leaders
    if (/^table of contents$/i.test(t)) return;
    const key = `${ref ?? ""}|${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ref, title: t, page: page.page_no });
  };
  SINGLE_LEVEL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SINGLE_LEVEL_RE.exec(page.text)) !== null) {
    if (isTocGhost(page.text, m.index + m[0].length)) continue;
    push(m[1] || null, m[2]);
    if (out.length >= 20) return out;
  }
  CAPS_HEADING_RE.lastIndex = 0;
  while ((m = CAPS_HEADING_RE.exec(page.text)) !== null) {
    if (isTocGhost(page.text, m.index + m[0].length)) continue;
    push(null, m[1]);
    if (out.length >= 20) return out;
  }
  EXHIBIT_RE.lastIndex = 0;
  while ((m = EXHIBIT_RE.exec(page.text)) !== null) {
    if (isTocGhost(page.text, m.index + m[0].length)) continue;
    push(null, m[1]);
    if (out.length >= 20) return out;
  }
  return out;
}

// Table-of-contents lines ("1. INTRODUCTION .... 3") name sections without
// meaning them — a heading followed by dotted leaders is never a chunk start.
function isTocGhost(text: string, afterIndex: number): boolean {
  return /\.{3,}|\s\d{1,3}\s*$/.test(text.slice(afterIndex, afterIndex + 90));
}

interface Boundary {
  page: number;
  headers: ChunkHeader[];
  source: ChunkSource;
}

function splitOversized(
  starts: { page: number; headers: ChunkHeader[]; source: ChunkSource }[],
  lastPage: number
): { page: number; headers: ChunkHeader[]; source: ChunkSource; partTitle?: string; partOf?: number }[] {
  const out: { page: number; headers: ChunkHeader[]; source: ChunkSource; partTitle?: string; partOf?: number }[] = [];
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].page - 1 : lastPage;
    const span = end - starts[i].page + 1;
    if (span <= MAX_CHUNK_PAGES) {
      out.push(starts[i]);
      continue;
    }
    const parts = Math.ceil(span / MAX_CHUNK_PAGES);
    for (let k = 0; k < parts; k++) {
      const p = starts[i].page + k * MAX_CHUNK_PAGES;
      const first = starts[i].headers[0];
      out.push({
        page: p,
        headers: k === 0 ? starts[i].headers : [{ ...first, page: p }],
        source: starts[i].source,
        partTitle: `${first.title} (part ${k + 1}/${parts})`,
        partOf: parts,
      });
    }
  }
  return out;
}

/**
 * Split a tender into section chunks. Core pages partition the document:
 * every page belongs to exactly one chunk (no gaps, no drops, no char cap).
 * Overlap pages are reported separately and included marked in
 * textWithOverlap — they never extend the core partition.
 */
export function chunkBySection(pages: ParsedPage[]): SectionChunk[] {
  if (pages.length === 0) return [];
  const sorted = [...pages].sort((a, b) => a.page_no - b.page_no);
  const lastPage = sorted[sorted.length - 1].page_no;
  const byPage = new Map(sorted.map((p) => [p.page_no, p.text]));

  // Pass 1: numbered headers.
  let boundaries: Boundary[] = [];
  for (const p of sorted) {
    const found = numberedHeadersOn(p);
    if (found.length === 0) continue;
    const last = boundaries[boundaries.length - 1];
    if (last && last.page === p.page_no) last.headers.push(...found);
    else boundaries.push({ page: p.page_no, headers: found, source: "numbered" });
  }
  // Pass 2: heading-style fallback (needs headings on ≥2 pages to trust it).
  if (boundaries.length === 0) {
    const headingStarts: Boundary[] = [];
    for (const p of sorted) {
      const found = headingFallbackOn(p);
      if (found.length === 0) continue;
      const last = headingStarts[headingStarts.length - 1];
      if (last && last.page === p.page_no) last.headers.push(...found);
      else headingStarts.push({ page: p.page_no, headers: found, source: "heading" });
    }
    const distinctPages = new Set(headingStarts.map((b) => b.page)).size;
    if (headingStarts.length > 0 && distinctPages >= 2) boundaries = headingStarts;
  }
  // Pass 3: page-based fallback — fixed windows, full coverage guaranteed.
  if (boundaries.length === 0) {
    for (let i = 0; i < sorted.length; i += PAGE_FALLBACK_SIZE) {
      const p = sorted[i];
      boundaries.push({
        page: p.page_no,
        headers: [{ ref: null, title: `Pages ${p.page_no}–${Math.min(p.page_no + PAGE_FALLBACK_SIZE - 1, lastPage)}`, page: p.page_no }],
        source: "page",
      });
    }
  }

  const starts = splitOversized(boundaries, lastPage);
  // Leading cover/TOC pages before the first heading belong to the first
  // chunk — never dropped.
  if (starts.length > 0 && starts[0].page > sorted[0].page_no) {
    starts[0] = { ...starts[0], page: sorted[0].page_no };
  }
  return starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].page - 1 : lastPage;
    const core: string[] = [];
    for (let n = s.page; n <= end; n++) core.push(byPage.get(n) ?? "");
    const text = core.join("\n");
    const overlapPages: number[] = [];
    if (s.page - 1 >= sorted[0].page_no) overlapPages.push(s.page - 1);
    if (end + 1 <= lastPage) overlapPages.push(end + 1);
    let textWithOverlap = text;
    if (s.page - 1 >= sorted[0].page_no) {
      textWithOverlap = `[overlap p.${s.page - 1}]\n${byPage.get(s.page - 1) ?? ""}\n${textWithOverlap}`;
    }
    if (end + 1 <= lastPage) {
      textWithOverlap = `${textWithOverlap}\n[overlap p.${end + 1}]\n${byPage.get(end + 1) ?? ""}`;
    }
    const first = s.headers[0];
    return {
      id: `c${i + 1}`,
      ref: first.ref,
      title: s.partTitle ?? first.title,
      startPage: s.page,
      endPage: end,
      text,
      textWithOverlap,
      overlapPages,
      pageCount: end - s.page + 1,
      charCount: text.length,
      source: s.source,
      headers: s.headers,
    };
  });
}

// ---------- document map ----------

export interface OutlineEntry {
  ref: string | null;
  title: string;
  page: number;
  chunkId: string;
}

export interface ZoneAssignment {
  chunkId: string;
  zone: ChunkZone;
  reason: string;
  hasBidClause: boolean;
}

export type GlobalRuleKind =
  | "disqualification"
  | "jv-partner"
  | "module-lot"
  | "format-order"
  | "key-date";

export interface GlobalRule {
  rule: GlobalRuleKind;
  page: number;
  text: string;
}

export interface SubmissionClause {
  chunkId: string;
  page: number;
  text: string;
}

export interface DocumentMap {
  pageCount: number;
  chunkCount: number;
  outline: OutlineEntry[];
  zones: ZoneAssignment[];
  globalRules: GlobalRule[];
  submissionClauses: SubmissionClause[];
}

// Zone signals read headings/structure only — never bare "shall"/"must".
const ZONE_TITLE: { match: RegExp; zone: ChunkZone; reason: string }[] = [
  { match: /pric|commercial|schedule of (prices|rates)|price basis|compensation/i, zone: "commercial", reason: "pricing/commercial heading" },
  { match: /questionnaire|\bform\b|template|exhibit|checklist/i, zone: "forms", reason: "form/questionnaire heading" },
  { match: /bid submission|submission requirement|instructions? to (bidders|tenderers)|should include|shall include|mandatory bid|tender requirements|evaluation criteria|deadline/i, zone: "bid-instructions", reason: "submission/instruction heading" },
  { match: /appendix|abbreviation|glossary|definition|reference/i, zone: "appendix", reason: "reference/appendix heading" },
];

function classifyZone(chunk: SectionChunk): { zone: ChunkZone; reason: string } {
  // Document preamble is narrative, never pricing — even when the cover page
  // names the document type ("Technical & Commercial RFQ").
  if (/^(introduction|background|overview|preamble|executive summary)/i.test(chunk.title)) {
    return { zone: "contract-scope", reason: "document preamble narrative" };
  }
  for (const z of ZONE_TITLE) {
    if (z.match.test(chunk.title)) return { zone: z.zone, reason: z.reason };
  }
  const head = chunk.text.slice(0, 600);
  // Lead-text signals stay strict: bare "commercial" (as in "technical and
  // commercial response") must not repaint an intro chunk as pricing.
  if (/pricing schedule|price basis|commercial (rfq|proposal|bid|offer)|pricing/i.test(head)) {
    return { zone: "commercial", reason: "commercial wording in section lead" };
  }
  if (/questionnaire|\bform\b|template/i.test(head)) {
    return { zone: "forms", reason: "form wording in section lead" };
  }
  return { zone: "contract-scope", reason: "default: scope/contract narrative" };
}

function windowAround(text: string, index: number, matchLen: number, radius = 120): string {
  return text.slice(Math.max(0, index - radius), index + matchLen + radius).replace(/\s+/g, " ").trim().slice(0, 300);
}

const GLOBAL_PATTERNS: { rule: GlobalRuleKind; re: RegExp; notIf?: RegExp }[] = [
  { rule: "disqualification", re: /disqualif|fatal flaw|will not be considered|will not be evaluated|shall be rejected|will be rejected|grounds for (rejection|disqualification)|invalidat\w* (your|the) bid/i },
  { rule: "jv-partner", re: /joint venture|technical partner|consortium|sub-?contractor|\bJV\b/i },
  // "package" alone is usually software ("State the package and version"),
  // not lot structure — excluded via notIf.
  { rule: "module-lot", re: /\bmodule\b|\blot\b|package [A-E]|scope group|\bpackage\b/i, notIf: /software package|package and version/i },
  { rule: "format-order", re: /no (changes?|alteration)( to| of)?|in separate (file|envelope)|separate (technical|commercial)|number of copies|original and \w+ cop/i },
  // Deadlines are often worded ("two weeks from receipt") without digits.
  { rule: "key-date", re: /(submission|clarification|bid validity|acceptance)[^.]{0,120}?(\d|one|two|three|four|five|six|seven|eight|nine|ten)/i },
];

// Bid-stage submission clauses hiding inside scope/contract text.
const BID_CLAUSE_RE = /submitted as part of (this|the) tender|with (the|this|your) (tender|bid)|at (bid|tender) (submission|closing)|mandatory with the bid|before bid submission|with its quotation|submit .* with (the|this) bid/i;

/**
 * Cheap deterministic map over pages + chunks: outline, per-chunk coarse
 * zone, global-rule candidates with pages, and bid-stage clauses found
 * inside contract-scope chunks. Caps counts, never content.
 */
export function buildDocumentMap(pages: ParsedPage[], chunks: SectionChunk[]): DocumentMap {
  const outline: OutlineEntry[] = chunks.map((c) => ({
    ref: c.ref,
    title: c.title,
    page: c.startPage,
    chunkId: c.id,
  }));

  const chunkById = new Map(chunks.map((c) => [c.id, c]));
  const zones: ZoneAssignment[] = chunks.map((c) => {
    const { zone, reason } = classifyZone(c);
    return { chunkId: c.id, zone, reason, hasBidClause: false };
  });

  // Submission-clause sweep over contract-scope / appendix chunks only.
  const submissionClauses: SubmissionClause[] = [];
  for (const z of zones) {
    if (z.zone !== "contract-scope" && z.zone !== "appendix") continue;
    const chunk = chunkById.get(z.chunkId);
    if (!chunk) continue;
    for (let n = chunk.startPage; n <= chunk.endPage; n++) {
      const text = pages.find((p) => p.page_no === n)?.text ?? "";
      BID_CLAUSE_RE.lastIndex = 0;
      const m = BID_CLAUSE_RE.exec(text);
      if (m) {
        z.hasBidClause = true;
        submissionClauses.push({ chunkId: z.chunkId, page: n, text: windowAround(text, m.index, m[0].length) });
        if (submissionClauses.length >= 200) break;
      }
    }
    if (submissionClauses.length >= 200) break;
  }

  const globalRules: GlobalRule[] = [];
  for (const p of pages) {
    for (const { rule, re, notIf } of GLOBAL_PATTERNS) {
      re.lastIndex = 0;
      const m = re.exec(p.text);
      if (m) {
        const text = windowAround(p.text, m.index, m[0].length);
        if (notIf && notIf.test(text)) continue;
        globalRules.push({ rule, page: p.page_no, text });
        if (globalRules.length >= 200) break;
      }
    }
    if (globalRules.length >= 200) break;
  }

  return {
    pageCount: pages.length,
    chunkCount: chunks.length,
    outline,
    zones,
    globalRules,
    submissionClauses,
  };
}

/** Chunks a later phase may send to Gemini: bid-stage zones + flagged scope. */
export function bidChunkIds(map: DocumentMap): string[] {
  return map.zones
    .filter((z) => z.zone === "bid-instructions" || z.zone === "forms" || z.zone === "commercial" || z.hasBidClause)
    .map((z) => z.chunkId);
}
