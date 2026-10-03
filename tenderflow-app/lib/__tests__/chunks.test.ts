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

import { hasBidderSubjectSentence, bidChunkPlan } from "../chunks";

// ---------------------------------------------------------------------------
// Phase 2a-fix: bidder-subject sentence detection
// ---------------------------------------------------------------------------

describe("hasBidderSubjectSentence", () => {
  it("flags 'Bidders shall price' sentences", () => {
    expect(hasBidderSubjectSentence("Bidders shall price against the stated tender assumption.")).toBe(true);
  });

  it("flags 'Tenderers shall state' sentences", () => {
    expect(hasBidderSubjectSentence("Tenderers shall state whether they propose to use a third party.")).toBe(true);
  });

  it("flags 'the tenderer shall' (with article)", () => {
    expect(hasBidderSubjectSentence("The tenderer shall include a method statement.")).toBe(true);
  });

  it("flags 'to be submitted with the tender'", () => {
    expect(hasBidderSubjectSentence("The following documents to be submitted with the tender.")).toBe(true);
  });

  it("flags 'shall be priced separately'", () => {
    expect(hasBidderSubjectSentence("Optional items shall be priced separately and shall not be included in the base total.")).toBe(true);
  });

  it("does NOT flag 'Contractor shall' sentences", () => {
    expect(hasBidderSubjectSentence("Contractor shall attend a project initiation meeting.")).toBe(false);
  });

  it("does NOT flag 'The Contractor shall' sentences", () => {
    expect(hasBidderSubjectSentence("The Contractor shall establish an approved design basis.")).toBe(false);
  });

  it("does NOT flag 'Company shall' sentences", () => {
    expect(hasBidderSubjectSentence("Company shall issue Work Permits on a case-by-case basis.")).toBe(false);
  });

  it("flags bidder-subject even when Contractor also appears later in text", () => {
    const text = "Bidders shall price by scope group. Contractor shall perform the work in accordance with this scope.";
    expect(hasBidderSubjectSentence(text)).toBe(true);
  });

  it("does not flag pure Contractor paragraphs", () => {
    const text = "Contractor shall attend a project initiation meeting. Contractor shall establish an approved design basis.";
    expect(hasBidderSubjectSentence(text)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 2a-fix: evaluation-method global rule
// ---------------------------------------------------------------------------

describe("evaluation-method global rule", () => {
  it("catches 'bids will be evaluated' phrasing", () => {
    const t = pages("4.3 Evaluation Criteria Bids will be evaluated on technical and commercial criteria, scored separately.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "evaluation-method")).toBe(true);
  });

  it("catches scoring weights", () => {
    const t = pages("4.3 EVALUATION Category Weighting Technical method with Sections 2.9 carrying the greatest weight 40%");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "evaluation-method")).toBe(true);
  });

  it("catches 'preferential consideration'", () => {
    const t = pages("3. BID EVALUATION Bidders with local content will receive preferential consideration during award.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "evaluation-method")).toBe(true);
  });

  it("does not fire on pure abbreviation pages", () => {
    const t = pages("1.5 Abbreviations API American Petroleum Institute CP Cathodic Protection VIV Vortex-Induced Vibration");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "evaluation-method")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 2a-fix: key-date extended patterns
// ---------------------------------------------------------------------------

describe("key-date extended patterns", () => {
  it("catches worded acceptance/clarification/submission deadlines", () => {
    const t = pages("6. RFQ DATES Acceptance: one week from receipt. Clarifications: one week. Submission: two weeks.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "key-date")).toBe(true);
  });

  it("catches 'bid validity' deadline with digit", () => {
    const t = pages("4.6 Bid validity period. Bids shall remain valid for 90 days from the submission deadline.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "key-date")).toBe(true);
  });

  it("catches clarification cut-off with a numeric date", () => {
    const t = pages("5. DATES Clarification deadline: 05 July 2026. Submission deadline: 20 July 2026.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.filter((g) => g.rule === "key-date").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 2a-fix: bidChunkPlan explicit full/flagged split
// ---------------------------------------------------------------------------

describe("bidChunkPlan full/flagged split", () => {
  const cLike = pages(
    "1.0 INTRODUCTION This scope defines the engineering analysis required.",
    "2.2 Stated Assumptions. They are stated here because tenderers shall price them deliberately.",
    "4.1 Mandatory Bid Content Method statement. CVs of the named lead analyst. Schedule with critical path.",
    "4.2 Pricing Schedule Bidders shall price by scope group. Optional items shall be priced separately.",
    "Appendix 1 Load Case Matrix R O R O R O."
  );
  const cChunks = chunkBySection(cLike);
  const cMap = buildDocumentMap(cLike, cChunks);
  const plan = bidChunkPlan(cMap);

  it("puts bid-instructions and commercial chunks in fullChunks", () => {
    const fullRefs = plan.fullChunks.map((id) => cChunks.find((c) => c.id === id)!.ref ?? "");
    expect(fullRefs.some((r) => /4\.1/.test(r))).toBe(true);
    expect(fullRefs.some((r) => /4\.2/.test(r))).toBe(true);
  });

  it("puts flagged scope chunks in flaggedChunks, not fullChunks", () => {
    const fullIds = new Set(plan.fullChunks);
    expect(plan.flaggedChunks.length).toBeGreaterThan(0);
    plan.flaggedChunks.forEach((id) => expect(fullIds.has(id)).toBe(false));
  });

  it("allChunkIds is union of full and flagged with no duplicates", () => {
    const all = new Set(plan.allChunkIds);
    expect(all.size).toBe(plan.allChunkIds.length);
    plan.fullChunks.forEach((id) => expect(all.has(id)).toBe(true));
    plan.flaggedChunks.forEach((id) => expect(all.has(id)).toBe(true));
  });

  it("appendix chunks without bid clauses stay local", () => {
    const allSent = new Set(plan.allChunkIds);
    const localAppendix = cChunks.filter((c) => {
      const z = cMap.zones.find((zz) => zz.chunkId === c.id);
      return z?.zone === "appendix" && !z.hasBidClause;
    });
    localAppendix.forEach((c) => expect(allSent.has(c.id)).toBe(false));
  });

  it("intro chunk without bid clause stays local", () => {
    const allSent = new Set(plan.allChunkIds);
    const intro = cChunks.find((c) => /INTRODUCTION/.test(c.title));
    if (intro) expect(allSent.has(intro.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 2a-fix: submission clause via bidder-subject in contract-scope
// ---------------------------------------------------------------------------

describe("submission clause via bidder-subject in contract-scope", () => {
  it("flags a scope chunk with tenderers-shall-price clause", () => {
    const t = pages(
      "1.0 INTRODUCTION Scope defines the engineering required to qualify the conductor.",
      "2.2 Stated Assumptions. They are stated here because tenderers shall price them deliberately.",
      "4.1 Mandatory Bid Content Method statement. CVs. Schedule."
    );
    const c = chunkBySection(t);
    const m = buildDocumentMap(t, c);
    const flagged = m.zones.filter((z) => z.hasBidClause);
    expect(flagged.length).toBeGreaterThan(0);
    const flaggedChunk = c.find((x) => x.id === flagged[0].chunkId)!;
    expect(flaggedChunk.ref).toBe("2.2");
    expect(m.submissionClauses.some((s) => s.chunkId === flaggedChunk.id)).toBe(true);
  });

  it("does NOT flag a chunk whose sentences are all Contractor-subject", () => {
    const t = pages(
      "2.0 SCOPE Contractor shall attend the meeting. Contractor shall establish the design basis. Contractor shall analyse all four phases."
    );
    const c = chunkBySection(t);
    const m = buildDocumentMap(t, c);
    expect(m.zones.every((z) => !z.hasBidClause)).toBe(true);
    expect(m.submissionClauses).toHaveLength(0);
  });
});
