// Phase 2a — chunker + document map. Pure functions only: no database,
// no network, no live Gemini. Run: npm test.
import { describe, expect, it } from "vitest";
import {
  bidChunkIds,
  buildDocumentMap,
  chunkBySection,
  MAX_CHUNK_PAGES,
} from "../chunks";
import type { ParsedPage } from "../pdf";

function pages(...texts: string[]): ParsedPage[] {
  return texts.map((text, i) => ({ page_no: i + 1, text, char_count: text.length }));
}

function corePagesOf(chunks: { startPage: number; endPage: number }[]): number[] {
  const out: number[] = [];
  for (const c of chunks) for (let n = c.startPage; n <= c.endPage; n++) out.push(n);
  return out.sort((a, b) => a - b);
}

describe("chunkBySection numbered mode", () => {
  const tender = pages(
    "4.0 TENDER REQUIREMENTS Scope of Work for analysis.",
    "4.1 Mandatory Bid Content. Method statement here.",
    "4.2 Pricing Schedule. Bidders shall price by scope group.",
    "4.3 Evaluation Criteria. Bids will be evaluated."
  );

  it("one chunk per header page with ref and title", () => {
    const chunks = chunkBySection(tender);
    expect(chunks.map((c) => c.ref)).toEqual(["4.0", "4.1", "4.2", "4.3"]);
    expect(chunks.every((c) => c.source === "numbered")).toBe(true);
    expect(chunks[1].title).toMatch(/Mandatory Bid Content/);
  });

  it("core pages partition the document exactly once", () => {
    const chunks = chunkBySection(tender);
    expect(corePagesOf(chunks)).toEqual([1, 2, 3, 4]);
  });

  it("overlap pages stay out of the core partition", () => {
    const chunks = chunkBySection(tender);
    expect(chunks[1].overlapPages).toEqual([1, 3]);
    expect(chunks[0].overlapPages).toEqual([2]);
    expect(chunks[3].overlapPages).toEqual([3]);
    expect(chunks[1].textWithOverlap).toMatch(/\[overlap p\.1\]/);
    expect(chunks[1].textWithOverlap).toMatch(/\[overlap p\.3\]/);
  });

  it("returns [] for no pages", () => {
    expect(chunkBySection([])).toEqual([]);
  });
});

describe("chunkBySection oversized split", () => {
  it("splits a 45-page section into bounded parts keeping the ref", () => {
    const texts = ["2.1 Execution Scope. Contract narrative begins."];
    for (let i = 2; i <= 45; i++) texts.push(`Contract narrative continues, page ${i}.`);
    const chunks = chunkBySection(pages(...texts));
    expect(chunks.length).toBe(Math.ceil(45 / MAX_CHUNK_PAGES));
    expect(chunks.every((c) => c.pageCount <= MAX_CHUNK_PAGES)).toBe(true);
    expect(chunks.every((c) => c.ref === "2.1")).toBe(true);
    expect(corePagesOf(chunks)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    expect(chunks[0].title).toMatch(/part 1\//);
  });
});

describe("chunkBySection heading fallback (Damas-style RFQ)", () => {
  const damasLike = pages(
    "PROVISION OF WELL DESIGN RFQ OML 110 July, 2026",
    "Table of Contents 1. INTRODUCTION .... 3 2. FIELD INFORMATION .... 3",
    "1. INTRODUCTION Damas Petrochemicals operators of OML 110, hereby invites companies.",
    "4. SCOPE OF WORK General CONTRACTOR represents that it has persons. Drilling: Recommending bits per hole section.",
    "5. RFQ BID SUBMISSION REQUIREMENT TECHNICAL RFQ SHOULD INCLUDE: A work execution plan. COMMERCIAL RFQ SHOULD INCLUDE: Cost of all products."
  );

  it("uses heading style when no x.y headers exist", () => {
    const chunks = chunkBySection(damasLike);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.every((c) => c.source === "heading")).toBe(true);
    expect(corePagesOf(chunks)).toEqual([1, 2, 3, 4, 5]);
  });

  it("finds the bid submission heading", () => {
    const chunks = chunkBySection(damasLike);
    expect(chunks.some((c) => /BID SUBMISSION/i.test(c.title))).toBe(true);
  });

  it("ignores TOC ghost headings with dotted leaders", () => {
    const chunks = chunkBySection(
      pages(
        "Cover page with tender name and nothing else at all here.",
        "Table of Contents 1. INTRODUCTION .... 3 2. FIELD INFORMATION .... 3",
        "1. INTRODUCTION Real introduction narrative starts here.",
        "2. FIELD INFORMATION Water depths and geology narrative here."
      )
    );
    // TOC page contributes no heading: chunks start at the real sections.
    expect(chunks.every((c) => !/\.{4,}/.test(c.title))).toBe(true);
    expect(chunks.map((c) => c.title).join(" | ")).toMatch(/Real introduction/);
  });
});

describe("chunkBySection page fallback", () => {
  it("windows content with no headings at all", () => {
    const texts = Array.from({ length: 12 }, (_, i) => `Plain narrative paragraph number ${i + 1} with enough words to avoid heading shapes and lowercase tone.`);
    const chunks = chunkBySection(pages(...texts));
    expect(chunks.length).toBe(3); // 5 + 5 + 2
    expect(chunks.every((c) => c.source === "page")).toBe(true);
    expect(corePagesOf(chunks)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});

describe("chunkBySection at 500 pages", () => {
  function bigTender(): ParsedPage[] {
    const out: ParsedPage[] = [];
    const push = (text: string) => out.push({ page_no: out.length + 1, text, char_count: text.length });
    push("1.0 INTRODUCTION Project background and objectives.");
    for (let i = 0; i < 8; i++) push(`Introduction narrative page ${i + 2} with background details.`);
    push("3.1 Execution Scope. Contract narrative begins here.");
    for (let i = 0; i < 460; i++) push(`Contract execution narrative, obligations during the works, page ${11 + i}. Terms and conditions continue.`);
    push("4.1 Mandatory Bid Content. Method statement per Section 2.21.");
    for (let i = 0; i < 19; i++) push(`Bid content continuation ${i + 1}: software versions, CVs, schedules.`);
    push("4.2 Pricing Schedule. Bidders shall price by scope group.");
    for (let i = 0; i < 9; i++) push(`Pricing continuation ${i + 1}: Group A lump sum, Group B lump sum.`);
    return out; // 10 + 460 + 20 + 10 = 500
  }

  it("covers all 500 pages exactly once, quickly, with no char cap", () => {
    const tender = bigTender();
    expect(tender.length).toBe(500);
    const t0 = Date.now();
    const chunks = chunkBySection(tender);
    const ms = Date.now() - t0;
    expect(corePagesOf(chunks)).toEqual(Array.from({ length: 500 }, (_, i) => i + 1));
    expect(ms).toBeLessThan(5000);
    // 461-page contract section splits into bounded parts under one ref.
    const contract = chunks.filter((c) => c.ref === "3.1");
    expect(contract.length).toBe(Math.ceil(461 / MAX_CHUNK_PAGES));
    expect(contract.every((c) => c.pageCount <= MAX_CHUNK_PAGES)).toBe(true);
    // First and last page text both present somewhere.
    const all = chunks.map((c) => c.text).join("\n");
    expect(all).toMatch(/Project background/);
    expect(all).toMatch(/Group B lump sum/);
  });
});

describe("buildDocumentMap", () => {
  const tender = pages(
    "4.0 TENDER REQUIREMENTS Instructions to tenderers for submission.",
    "4.1 Mandatory Bid Content. Method statement. Failure to quote shall lead to disqualification.",
    "2.4 Design Basis. Contractor shall analyse all four phases. Submitted as part of this tender: design basis note.",
    "4.2 Pricing Schedule. Group A lump sum. Joint venture partners must price jointly.",
    "Section 8 Compliance Questionnaire. Complete all fields.",
    "Appendix 1 Load Case Matrix. Submission is two weeks from receipt, valid for 90 days."
  );
  const chunks = chunkBySection(tender);
  const map = buildDocumentMap(tender, chunks);

  it("zones chunks from headings, not from shall", () => {
    const zone = Object.fromEntries(map.zones.map((z) => {
      const c = chunks.find((x) => x.id === z.chunkId)!;
      return [c.ref ?? c.title, z.zone];
    }));
    expect(zone["4.1"]).toBe("bid-instructions");
    expect(zone["4.2"]).toBe("commercial");
    expect(zone["2.4"]).toBe("contract-scope");
  });

  it("flags bid-stage clauses hiding in scope chunks", () => {
    const flagged = map.zones.filter((z) => z.hasBidClause);
    expect(flagged.length).toBe(1);
    const chunk = chunks.find((c) => c.id === flagged[0].chunkId)!;
    expect(chunk.ref).toBe("2.4");
    expect(map.submissionClauses[0].text).toMatch(/Submitted as part of this tender/i);
  });

  it("collects global-rule candidates with pages", () => {
    const kinds = map.globalRules.map((g) => `${g.rule}@p.${g.page}`).join(" ");
    expect(kinds).toMatch(/disqualification@p\.2/);
    expect(kinds).toMatch(/jv-partner@p\.4/);
    expect(kinds).toMatch(/key-date@p\.6/);
  });

  it("does not mistake a software package for lot structure", () => {
    const t = pages("2.17 Analysis Methods. State the package and version of the software used.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.filter((g) => g.rule === "module-lot")).toEqual([]);
  });

  it("catches worded deadlines without digits", () => {
    const t = pages("6. RFQ DATES Submission: two weeks from receipt of RFQ document.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "key-date")).toBe(true);
  });

  it("bidChunkIds sends bid zones plus flagged scope, nothing else", () => {
    const ids = bidChunkIds(map);
    const refs = ids.map((id) => chunks.find((c) => c.id === id)!.ref ?? chunks.find((c) => c.id === id)!.title);
    expect(refs.join(" ")).toMatch(/4\.1/);
    expect(refs.join(" ")).toMatch(/4\.2/);
    expect(refs.join(" ")).toMatch(/2\.4/); // flagged scope included
    expect(refs.join(" ")).not.toMatch(/Appendix/);
  });
});
