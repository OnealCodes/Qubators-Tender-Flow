// Heuristic overview extraction v1 — deterministic, local, no model calls.
// Finds dates, references, meetings and bucket keywords with page citations.
// Every field records the page it came from (source grounding). The AI
// extract/v1 contract (lib/ai-schemas.ts) takes over in a later phase;
// this keeps Phase 3 usable and testable without paid services.

import type { ParsedPdf } from "./pdf";

export interface OverviewField {
  value: string | null;
  page: number | null;
}

export interface TenderOverview {
  client: OverviewField;
  title: OverviewField;
  reference: OverviewField;
  scope: OverviewField;
  submission_deadline: OverviewField;
  clarification_deadline: OverviewField;
  clarification_meeting: OverviewField;
  submission_format: OverviewField;
  instructions: OverviewField;
  bucket_counts: Record<string, number>;
}

const BUCKET_TERMS: Record<string, string[]> = {
  Technical: ["technical", "specification", "scope of work", "deliverable", "equipment"],
  "Nigerian Content": ["nigerian content", "nogic", "ncdmb", "nuprc", "local content"],
  HSE: ["hse", "safety", "health", "environment", "jha", "hazard"],
  Financial: ["financial", "audited", "tax", "invoice", "payment", "account"],
  Commercial: ["commercial", "price", "pricing", "quote", "quotation", "bid bond"],
};

const DATE_PATTERNS = [
  /(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/gi,
  /(\d{4}-\d{2}-\d{2})/g,
  /(\d{1,2}\/\d{1,2}\/\d{4})/g,
];

function firstDateNear(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  let best: { date: string; score: number } | null = null;
  for (const kw of keywords) {
    const ki = lower.indexOf(kw);
    if (ki < 0) continue;
    for (const pat of DATE_PATTERNS) {
      pat.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pat.exec(text)) !== null) {
        // Prefer dates written AFTER the keyword (e.g. "Deadline: 5 July");
        // heavily penalise dates appearing before it.
        const score = m.index >= ki ? m.index - ki : ki - m.index + 500;
        if (score < 300 && (!best || score < best.score)) best = { date: m[1], score };
      }
    }
  }
  return best?.date ?? null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    p.lastIndex = 0;
    const m = p.exec(text);
    if (m) return (m[1] ?? m[0]).trim();
  }
  return null;
}

export function extractOverview(parsed: ParsedPdf, fileName: string): TenderOverview {
  const field = (value: string | null, page: number | null): OverviewField => ({ value, page });
  const pages = parsed.pages;

  const findAll = (fn: (text: string) => string | null): { value: string; page: number } | null => {
    for (const p of pages) {
      const v = fn(p.text);
      if (v) return { value: v, page: p.page_no };
    }
    return null;
  };

  const ref = findAll((t) =>
    firstMatch(t, [/reference\s*(?:no|number)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{3,})/i, /tender\s*(?:no|number|ref)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{3,})/i])
  );
  const sub = findAll((t) => {
    const v = firstDateNear(t, ["submission deadline", "closing date", "bid submission", "submit bids", "submission date"]);
    return v;
  });
  const clar = findAll((t) => firstDateNear(t, ["clarification deadline", "queries deadline", "clarifications by"]) ?? null);
  const meet = findAll((t) => firstDateNear(t, ["clarification meeting", "pre-bid meeting", "pre-bid conference", "bid meeting"]) ?? null);
  const client = findAll((t) =>
    firstMatch(t, [/client\s*[:#]?\s*([A-Z][A-Za-z& ]{2,40})/, /issued by\s*([A-Z][A-Za-z& ]{2,40})/i])
  ) ?? findAll((t) =>
    firstMatch(t, [/^(.{3,50}?(?:Limited|Ltd|PLC|Inc\.?))\b/m])
  );
  const title = findAll((t) =>
    firstMatch(t, [/provision of ([A-Za-z &,\-]{4,80})/i, /tender for ([A-Za-z &,\-]{4,80})/i, /invitation to tender[^.]{0,20}([A-Za-z &,\-]{4,80})/i])
  );
  const scope = findAll((t) =>
    firstMatch(t, [/scope of work\s*[:#]?\s*(.{20,200})/i, /scope\s*[:#]?\s*(.{20,200})/i])
  );
  const format = findAll((t) =>
    firstMatch(t, [/submission format\s*[:#]?\s*(.{5,120})/i, /submit (?:in|as)\s*(.{5,80})/i])
  );
  const instructions = findAll((t) =>
    firstMatch(t, [/important instructions?\s*[:#]?\s*(.{10,200})/i, /instructions to bidders?\s*[:#]?\s*(.{10,200})/i])
  );

  const bucket_counts: Record<string, number> = {};
  for (const [bucket, terms] of Object.entries(BUCKET_TERMS)) {
    let hits = 0;
    for (const p of pages) {
      const lower = p.text.toLowerCase();
      for (const term of terms) {
        let i = lower.indexOf(term);
        while (i >= 0) {
          hits++;
          i = lower.indexOf(term, i + term.length);
        }
      }
    }
    bucket_counts[bucket] = hits;
  }

  return {
    client: client ? field(client.value, client.page) : field(null, null),
    title: title ? field(title.value, title.page) : field(fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "), null),
    reference: ref ? field(ref.value, ref.page) : field(null, null),
    scope: scope ? field(scope.value.slice(0, 200), scope.page) : field(null, null),
    submission_deadline: sub ? field(sub.value, sub.page) : field(null, null),
    clarification_deadline: clar ? field(clar.value, clar.page) : field(null, null),
    clarification_meeting: meet ? field(meet.value, meet.page) : field(null, null),
    submission_format: format ? field(format.value, format.page) : field(null, null),
    instructions: instructions ? field(instructions.value.slice(0, 200), instructions.page) : field(null, null),
    bucket_counts,
  };
}
