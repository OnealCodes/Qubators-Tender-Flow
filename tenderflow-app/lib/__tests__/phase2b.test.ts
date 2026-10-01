// Phase 2b — bidder subject detection, evaluation-method, bidChunkPlan.
// Pure functions only: no database, no network, no live Gemini. Run: npm test.
import { describe, expect, it } from "vitest";
import {
  bidChunkPlan,
  buildDocumentMap,
  chunkBySection,
  hasBidderSubjectSentence,
} from "../chunks";
import type { ParsedPage } from "../pdf";

function pages(...texts: string[]): ParsedPage[] {
  return texts.map((text, i) => ({ page_no: i + 1, text, char_count: text.length }));
}

describe("hasBidderSubjectSentence", () => {
  it("detects 'Bidders shall price...'", () => {
    expect(hasBidderSubjectSentence("Bidders shall price against the stated assumption.")).toBe(true);
  });
  it("detects 'Tenderers must submit...'", () => {
    expect(hasBidderSubjectSentence("Tenderers must submit their proposal by Friday.")).toBe(true);
  });
  it("detects 'you shall...'", () => {
    expect(hasBidderSubjectSentence("You shall complete the form and return it.")).toBe(true);
  });
  it("detects 'to be submitted with the tender'", () => {
    expect(hasBidderSubjectSentence("The document is to be submitted with the tender.")).toBe(true);
  });
  it("detects 'shall be priced separately'", () => {
    expect(hasBidderSubjectSentence("Optional items shall be priced separately.")).toBe(true);
  });
  it("detects 'the tenderer shall...'", () => {
    expect(hasBidderSubjectSentence("The tenderer shall provide evidence of registration.")).toBe(true);
  });
  it("EXCLUDES 'Contractor shall...'", () => {
    expect(hasBidderSubjectSentence("Contractor shall attend a kick-off meeting.")).toBe(false);
  });
  it("EXCLUDES 'Company shall...'", () => {
    expect(hasBidderSubjectSentence("Company shall provide data at kick-off.")).toBe(false);
  });
  it("EXCLUDES 'The Contractor...'", () => {
    expect(hasBidderSubjectSentence("The Contractor shall analyse all four phases.")).toBe(false);
  });
  it("EXCLUDES 'the Contractor...' (lowercase)", () => {
    expect(hasBidderSubjectSentence("the Contractor shall submit reports monthly.")).toBe(false);
  });
  it("ignores non-bidder sentences with 'shall'", () => {
    expect(hasBidderSubjectSentence("The weld classification shall reflect a field girth weld.")).toBe(false);
  });
});

describe("evaluation-method global rule", () => {
  it("detects scoring weights", () => {
    const t = pages("4.3 Evaluation Criteria. Technical method 40%. Experience 15%.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "evaluation-method")).toBe(true);
  });
  it("detects 'will be evaluated'", () => {
    const t = pages("Bids will be evaluated on technical and commercial criteria.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "evaluation-method")).toBe(true);
  });
  it("detects 'preferential consideration'", () => {
    const t = pages("Local content will receive preferential consideration.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "evaluation-method")).toBe(true);
  });
  it("detects points system", () => {
    const t = pages("A points system will be used: technical 70, commercial 30.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "evaluation-method")).toBe(true);
  });
});

describe("key-date global rule (expanded)", () => {
  it("detects bid validity", () => {
    const t = pages("Bid validity: 90 days from submission.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "key-date")).toBe(true);
  });
  it("detects clarification cut-off", () => {
    const t = pages("Clarification deadline: two weeks from receipt.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "key-date")).toBe(true);
  });
  it("detects acknowledgement deadline", () => {
    const t = pages("Acknowledgement of receipt within five days.");
    const m = buildDocumentMap(t, chunkBySection(t));
    expect(m.globalRules.some((g) => g.rule === "key-date")).toBe(true);
  });
});

describe("bidChunkPlan explicit zones", () => {
  const tender = pages(
    "4.1 Mandatory Bid Content. Method statement.",
    "2.5 Scope. Contractor shall analyse all phases. Bidders shall state pricing.",
    "4.2 Pricing Schedule. Group A lump sum.",
    "Appendix 1 Load Cases. Tenderers must submit with bid."
  );
  const chunks = chunkBySection(tender);
  const map = buildDocumentMap(tender, chunks);
  const plan = bidChunkPlan(map);

  it("fullChunks includes bid-instructions, forms, commercial", () => {
    expect(plan.fullChunks.length).toBeGreaterThanOrEqual(2);
    const zoneOf = (id: string) => map.zones.find((z) => z.chunkId === id)?.zone;
    for (const id of plan.fullChunks) {
      expect(["bid-instructions", "forms", "commercial"]).toContain(zoneOf(id));
    }
  });

  it("flaggedChunks only from contract-scope/appendix with bidder subject", () => {
    for (const id of plan.flaggedChunks) {
      const z = map.zones.find((x) => x.chunkId === id);
      expect(z?.hasBidClause).toBe(true);
      expect(["contract-scope", "appendix"]).toContain(z?.zone);
    }
  });

  it("allChunkIds is union of full + flagged, no duplicates", () => {
    const union = [...new Set([...plan.fullChunks, ...plan.flaggedChunks])];
    expect(plan.allChunkIds.length).toBe(union.length);
    expect(plan.allChunkIds.sort()).toEqual(union.sort());
  });
});

describe("bidder-subject detection catches recall-critical cases", () => {
  // These are the Conductor cases that were previously lost
  it("catches 'tenderers shall price them deliberately'", () => {
    const text = "They are stated here rather than left implicit in the work sections because tenderers shall price them deliberately.";
    expect(hasBidderSubjectSentence(text)).toBe(true);
  });
  it("catches 'Bidders shall price against the stated tender assumption'", () => {
    const text = "Bidders shall price against the stated tender assumption and shall not substitute their own.";
    expect(hasBidderSubjectSentence(text)).toBe(true);
  });
  it("catches 'Bidders shall state whether they propose...'", () => {
    const text = "Bidders shall state whether they propose to provide this within their own organisation or via a nominated third party.";
    expect(hasBidderSubjectSentence(text)).toBe(true);
  });
  it("catches 'Tenderers must submit with the bid'", () => {
    const text = "Tenderers must submit the schedule with the bid.";
    expect(hasBidderSubjectSentence(text)).toBe(true);
  });
});