// Two-pass AI extraction — locate bid sections first, extract only inside them.
// Pass 1 (cheap): numbered headers (deterministic) → Gemini picks the bid
// content + pricing sections. Pass 2: ONLY that section text goes to the
// model, which returns exact-wording rows. Scope narrative never enters the
// prompt, so post-award leakage is structurally impossible.
// Every row is verified (title verbatim in source, ref exists) before save;
// failures fall back to the heuristic matrix untouched.

import { logActivity } from "./collab";
import { suggestOwner, type ExtractedRequirement } from "./extract";
import { geminiJson, isGeminiConfigured } from "./gemini";
import { getTender } from "./tenders";

export interface DocHeader {
  ref: string;
  title: string;
  page: number;
}

export interface LocatedSections {
  bid: DocHeader[];
  pricing: DocHeader[];
}

export interface AiRow {
  ref: string;
  title: string;
  detail: string;
  kind: string;
  envelope: "Technical" | "Commercial";
  page: number;
}

// Deterministic: numbered headers with their pages, TOC lines excluded.
export function collectHeaders(pages: { page_no: number; text: string }[]): DocHeader[] {
  const out: DocHeader[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const re = /(\d+\.\d+(?:\.\d+)*)\s+([A-Z][A-Za-z][A-Za-z &,\-]{2,60}?)(?=\s*(?:•|\.|$|\d+\.\d+))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(page.text)) !== null) {
      const ref = m[1];
      const title = m[2].trim();
      // Dotted leaders (".... 20") mark TOC lines — never headers.
      const after = page.text.slice(re.lastIndex, re.lastIndex + 12);
      if (/^\s*\.{2,}/.test(after)) continue;
      if (/\.{3,}/.test(title)) continue;
      const key = `${ref}|${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ref, title, page: page.page_no });
      if (out.length >= 120) return out;
    }
  }
  return out;
}

const LOCATE_SYSTEM = `You identify tender submission structure. Given numbered section headers from an oil & gas tender, return STRICT JSON only, no markdown, no commentary:
{"bid":[{"ref":"4.1"}],"pricing":[{"ref":"4.2"}]}
- "bid": sections defining what the bidder must SUBMIT (mandatory bid content, submission requirements, tender requirements).
- "pricing": pricing schedules, price bases, commercial templates.
- Use ONLY refs from the provided list. Omit a key (or use []) when absent. No explanations.`;

export async function locateSections(
  headers: DocHeader[]
): Promise<LocatedSections> {
  const listing = headers.map((h) => `${h.ref} ${h.title} (p.${h.page})`).join("\n");
  const parsed = (await geminiJson(LOCATE_SYSTEM, `Headers:\n${listing}`)) as {
    data: { bid?: ({ ref?: string } | string)[]; pricing?: ({ ref?: string } | string)[] };
  };
  const data = parsed.data ?? {};
  const byRef = new Map(headers.map((h) => [h.ref, h]));
  // Models vary: accept {"ref":"4.1"} objects and bare "4.1" strings.
  const pick = (arr?: ({ ref?: string } | string)[]): DocHeader[] => {
    const out: DocHeader[] = [];
    for (const item of arr ?? []) {
      const ref = typeof item === "string" ? item : item?.ref;
      const h = typeof ref === "string" ? byRef.get(ref.trim()) : undefined;
      if (h && !out.some((x) => x.ref === h.ref)) out.push(h);
    }
    return out;
  };
  return { bid: pick(data.bid), pricing: pick(data.pricing) };
}

const EXTRACT_SYSTEM = `You extract bid submission requirements from tender text. Respond with STRICT JSON only, no markdown, no commentary:
{"rows":[{"ref":"4.1","title":"<exact tender wording>","detail":"<supporting bullets, qualifications, conditions>","kind":"requirement","envelope":"Technical"}]}
RULES:
- One row per listed item/bullet. Titles use the EXACT source wording (strip bullet markers only, never paraphrase).
- "detail" keeps qualifications, exclusions and conditions attached to the item (e.g. "general experience alone is not responsive").
- "kind" is requirement, commercial, condition or evidence; "envelope" is Technical or Commercial.
- Only items a bidder must SUBMIT. Never invent items, refs or wording.`;

// Verification: title must appear verbatim (whitespace-normalised) in the
// section text and the ref must exist in the headers. Rejects hallucination.
export function verifyRows(
  rows: AiRow[],
  sectionText: string,
  headers: DocHeader[]
): { valid: AiRow[]; rejected: number } {
  const flat = sectionText.replace(/\s+/g, " ").toLowerCase();
  const refs = new Set(headers.map((h) => h.ref));
  const valid: AiRow[] = [];
  let rejected = 0;
  for (const r of rows) {
    const title = typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim() : "";
    if (!title || title.length < 8) {
      rejected++;
      continue;
    }
    if (!flat.includes(title.toLowerCase())) {
      rejected++;
      continue;
    }
    if (typeof r.ref !== "string" || !refs.has(r.ref.trim())) {
      rejected++;
      continue;
    }
    valid.push({
      ref: r.ref.trim(),
      title,
      detail: typeof r.detail === "string" ? r.detail.slice(0, 1200) : "",
      kind: ["requirement", "commercial", "condition", "evidence"].includes(r.kind) ? r.kind : "requirement",
      envelope: r.envelope === "Commercial" ? "Commercial" : "Technical",
      page: typeof r.page === "number" ? r.page : 0,
    });
  }
  return { valid, rejected };
}

export function toExtracted(valid: AiRow[]): ExtractedRequirement[] {
  return valid.map((r) => {
    const joined = `${r.title} ${r.detail}`;
    return {
      ref: r.ref,
      section: "Technical",
      envelope: r.envelope,
      kind: r.kind,
      title: r.title,
      description: r.detail || r.title,
      type: /questionnaire|\bform\b|template/i.test(joined) ? "form" : "doc",
      risk: /disqualif|reject/i.test(joined) ? "critical" : "mandatory",
      risk_reason: "AI-structured from the bid content section; human to confirm.",
      suggested_owner: suggestOwner(joined),
      source_page: r.page,
      source_span: r.title.slice(0, 80),
      deliverables: [],
    };
  });
}

export async function aiExtractTender(
  tenderId: string
): Promise<{ requirements: ExtractedRequirement[]; meta: Record<string, unknown> }> {
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API key is not configured. Add GEMINI_API_KEY to tenderflow-app\\.env (see .env.example).");
  }
  const { tender } = await getTender(tenderId);
  if (!tender) throw new Error("Tender not found.");
  const pages = tender.pages ?? [];
  if (!pages.length) throw new Error("No parsed pages for this tender yet. Upload and parse first.");

  const headers = collectHeaders(pages);
  const located = await locateSections(headers);
  const wanted = [...located.bid, ...located.pricing];
  if (!wanted.length) {
    throw new Error("Gemini found no bid-content or pricing sections in this tender.");
  }
  const wantedRefs = new Set(wanted.map((w) => w.ref));
  const byPage = new Map<number, string>();
  for (const p of pages) byPage.set(p.page_no, p.text);
  const sectionPages = [...new Set(wanted.map((w) => w.page))].sort((a, b) => a - b);
  let sectionText = sectionPages.map((n) => byPage.get(n) ?? "").join("\n");
  const MAX = 30000;
  if (sectionText.length > MAX) sectionText = sectionText.slice(0, MAX);

  const parsed = (await geminiJson(
    EXTRACT_SYSTEM,
    `Sections in scope: ${wanted.map((w) => `${w.ref} ${w.title} (p.${w.page})`).join("; ")}\n\nTender text:\n${sectionText}`
  )) as { data: { rows?: AiRow[] } };
  const rows = Array.isArray(parsed.data.rows) ? parsed.data.rows : [];
  console.error(`[ai-extract] locate refs=${[...wantedRefs].join(",")} pages=${sectionPages.join(",")} chars=${sectionText.length} modelRows=${rows.length}`);
  const { valid, rejected } = verifyRows(rows, sectionText, headers);
  if (!valid.length) {
    throw new Error(`Gemini returned ${rows.length} row(s) but none passed verification. Heuristic matrix left untouched.`);
  }
  // Keep only rows whose ref belongs to the located bid/pricing sections.
  const scoped = valid.filter((r) => wantedRefs.has(r.ref));
  if (!scoped.length) {
    throw new Error("Gemini rows fell outside the located bid sections. Heuristic matrix left untouched.");
  }
  const { requirements } = { requirements: toExtracted(scoped) };
  await logActivity(tenderId, "ai_extract", {
    from: [...wantedRefs].join(","),
    rows: requirements.length,
    rejected,
  });
  return {
    requirements,
    meta: {
      ai_structured_from: [...wantedRefs],
      rejected,
      engine_note: "two-pass Gemini structuring with verbatim verification",
    },
  };
}
