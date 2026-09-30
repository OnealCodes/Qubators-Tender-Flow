// Engine unit tests — run: npm test (vitest run). Pure functions only,
// no database, no network. Guards the behaviour proven on real ITTs.
import { describe, expect, it } from "vitest";
import { collectHeaders, toExtracted, verifyRows } from "../ai-extract";
import { extractRequirements } from "../extract";
import { expiryBadge, scoreMatch } from "../matching";
import { refineRisk, runQc } from "../qc";
import { computeReadiness, finalReview } from "../readiness";
import { mergeExtraction } from "../requirements";

function pages(...texts: string[]) {
  return texts.map((text, i) => ({ page_no: i + 1, text, char_count: text.length }));
}

describe("extractRequirements", () => {
  const reqs = (...texts: string[]) => extractRequirements(pages(...texts)).requirements;

  it("splits CO2/CO7 entities into sub-items under one parent", () => {
    const out = reqs(
      "Nigerian Content: Certified true copies of CAC Forms CO2 and CO7 respectively."
    );
    expect(out.length).toBe(1);
    expect(out[0].deliverables.map((d) => d.title)).toEqual(
      expect.arrayContaining(["CO2 certificate", "CO7 certificate"])
    );
    expect(out[0].section).toBe("Nigerian Content");
  });

  it("year-splits audited accounts", () => {
    const out = reqs(
      "Financial: Provide evidence of Three-Years Tax Clearance Certificate (2022, 2023, 2024)."
    );
    expect(out.length).toBe(1);
    expect(out[0].deliverables.length).toBeGreaterThanOrEqual(3);
  });

  it("marks conditional rows so they never count as missing", () => {
    const out = reqs("Provide Parent Company Guarantee if applicable.");
    expect(out[0].type).toBe("conditional");
    expect(out[0].risk).toBe("conditional");
  });

  it("flags disqualification wording as critical with a reason", () => {
    const out = reqs(
      "Commercial: failure to quote for ALL items shall lead to disqualification."
    );
    expect(out[0].risk).toBe("critical");
    expect(out[0].risk_reason.length).toBeGreaterThan(0);
  });

  it("demotes legal boilerplate to supporting without dropping it", () => {
    const out = reqs(
      "Tenderers shall maintain confidentiality since disclosure shall neither be construed as granting any rights"
    );
    expect(out.length).toBe(1);
    expect(out[0].risk).toBe("supporting");
  });

  it("dedupes identical segments", () => {
    const seg = "HSE: Tenderers must submit a safety programme before mobilisation.";
    const out = reqs(seg, seg);
    expect(out.length).toBe(1);
  });

  it("picks up verbless bullets inside Mandatory Bid Content", () => {
    const { requirements: out } = extractRequirements(
      pages("4.1 Mandatory Bid Content. Bidders must submit: • Method statement per Section 2.21. • Schedule with critical path.")
    );
    const titles = out.map((r) => r.title);
    expect(titles.some((t) => /method statement/i.test(t))).toBe(true);
    expect(titles.some((t) => /critical path/i.test(t))).toBe(true);
    expect(out.every((r) => r.envelope === "Technical")).toBe(true);
  });

  it("sets post-award execution clauses aside, never in the matrix", () => {
    const { requirements: out, meta } = extractRequirements(
      pages("Contract Execution. The Contractor shall supply SERVICES diligently during execution of the works after award.")
    );
    expect(out.length).toBe(0);
    expect(meta.skipped_post_award).toBeGreaterThan(0);
  });

  it("sets 'applicable to the work' execution clauses aside", () => {
    const { requirements: out, meta } = extractRequirements(
      pages("Contractor shall prepare a quality plan applicable to the work in accordance with the latest edition.")
    );
    expect(out.length).toBe(0);
    expect(meta.skipped_post_award).toBeGreaterThan(0);
  });

  it("keeps neighbouring Technical rows out of the Commercial envelope", () => {
    const { requirements: out } = extractRequirements(
      pages("4.2 Pricing Schedule. Item Scope Price basis Group A Sections Lump sum. Contractor shall prepare a quality plan for the bid.")
    );
    const plan = out.find((r) => /quality plan/i.test(r.title));
    expect(plan).toBeDefined();
    expect(plan!.envelope).toBe("Technical");
  });

  it("turns pricing-schedule rows into Commercial deliverables", () => {
    const { requirements: out } = extractRequirements(
      pages("4.2 Pricing Schedule. Bidders shall price by scope group. Group A Sections 2.4 to 2.8 Lump sum. Group B Sections 2.9 and 2.10 Lump sum, itemised separately.")
    );
    const pricing = out.find((r) => r.title === "Pricing Schedule — price by scope group");
    expect(pricing).toBeDefined();
    expect(pricing!.envelope).toBe("Commercial");
    expect(pricing!.deliverables.map((d) => d.title).join(" ")).toMatch(/Group A|Group B/);
  });

  it("captures evaluation weights instead of requirement rows", () => {
    const { requirements: out, meta } = extractRequirements(
      pages("4.3 Evaluation Criteria. Bids will be evaluated. Technical method 40%. Nigerian content 10%.")
    );
    expect(out.length).toBe(0);
    expect(meta.weights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ criterion: "Technical method", weight: "40%" }),
      ])
    );
  });

  it("keeps numbered ref and exact tender wording as the title", () => {
    const { requirements: out } = extractRequirements(
      pages("4.1 Mandatory Bid Content. • CVs of the named lead analyst, checker and any third-party verifier.")
    );
    expect(out.length).toBe(1);
    expect(out[0].ref).toBe("4.1");
    expect(out[0].title).toBe("CVs of the named lead analyst, checker and any third-party verifier.");
  });

  it("gives trailing refs in combined headers to the bullets below", () => {
    const { requirements: out } = extractRequirements(
      pages("4.0 TENDER REQUIREMENTS 4.1 Mandatory Bid Content • Method statement per Section 2.21. • Software proposed for each analysis type.")
    );
    expect(out.length).toBe(2);
    expect(out.every((r) => r.ref === "4.1")).toBe(true);
    expect(out[0].title).toMatch(/Method statement/);
    expect(out[1].title).toMatch(/Software proposed/);
  });

  it("joins qualifications into the same row instead of new rows", () => {
    const { requirements: out } = extractRequirements(
      pages("• Reference projects: free-standing conductors. General offshore structural experience alone is not responsive to this scope.")
    );
    expect(out.length).toBe(1);
    expect(out[0].description).toMatch(/not responsive/);
  });

  it("never creates echo deliverables for single-entity rows", () => {
    const { requirements: out } = extractRequirements(
      pages("Tenderers must provide a valid NUPRC certificate before mobilisation.")
    );
    expect(out.length).toBe(1);
    expect(out[0].deliverables.length).toBe(0);
  });

  it("still splits genuinely distinct collectables", () => {
    const { requirements: out } = extractRequirements(
      pages("Tenderers must provide CO2 and CO7 certificates.")
    );
    expect(out.length).toBe(1);
    expect(out[0].deliverables.map((d) => d.title)).toEqual(
      expect.arrayContaining(["CO2 certificate", "CO7 certificate"])
    );
  });
});

describe("two-pass AI structuring helpers", () => {
  const headers = [
    { ref: "4.0", title: "TENDER REQUIREMENTS", page: 20 },
    { ref: "4.1", title: "Mandatory Bid Content", page: 20 },
    { ref: "4.2", title: "Pricing Schedule", page: 20 },
  ];

  it("collects numbered headers with pages, skipping TOC lines", () => {
    const found = collectHeaders([
      { page_no: 3, text: "4.1 Mandatory Bid Content .................... 20 4.2 Pricing Schedule .... 20" },
      { page_no: 20, text: "4.1 Mandatory Bid Content. Scope of Work for analysis." },
    ]);
    expect(found.some((h) => h.ref === "4.1" && h.page === 20)).toBe(true);
    expect(found.every((h) => !/\.{3,}/.test(h.title))).toBe(true);
  });

  it("rejects hallucinated titles, unknown refs and short rows", () => {
    const section = "CVs of the named lead analyst, checker and any third-party verifier.";
    const { valid, rejected } = verifyRows(
      [
        { ref: "4.1", title: "CVs of the named lead analyst, checker and any third-party verifier.", detail: "", kind: "requirement", envelope: "Technical", page: 20 },
        { ref: "4.1", title: "Provide ten submarines immediately.", detail: "", kind: "requirement", envelope: "Technical", page: 20 },
        { ref: "9.9", title: "CVs of the named lead analyst.", detail: "", kind: "requirement", envelope: "Technical", page: 20 },
      ],
      section,
      headers
    );
    expect(valid.length).toBe(1);
    expect(rejected).toBe(2);
  });

  it("converts verified rows to extraction shape with suggestions", () => {
    const out = toExtracted([
      { ref: "4.1", title: "Nigerian Content Plan and NCDMB compliance evidence.", detail: "", kind: "requirement", envelope: "Technical", page: 20 },
    ]);
    expect(out[0].suggested_owner).toBe("Nigerian Content");
    expect(out[0].deliverables).toEqual([]);
  });
});

describe("matching", () => {  const doc = (name: string, extra = {}) => ({
    id: "l1", company_id: "demo", name, doc_type: "registration",
    version: "v1", version_no: 1, superseded: false, issue_date: null,
    expiry_date: null, dept: null, entity: "NUPRC", storage_path: null,
    file_size: 0, status: "valid", created_at: "",
    ...extra,
  });

  it("matches the exact entity with high confidence", () => {
    const { confidence } = scoreMatch("NUPRC certificate", "NUPRC certificate required", doc("NUPRC Certificate"));
    expect(confidence).toBe("high");
  });

  it("does not match via passing context mentions", () => {
    const { confidence } = scoreMatch(
      "2022 audited accounts",
      "2022, 2023, 2024 accounts and tax clearance",
      doc("Tax Clearance", { entity: null })
    );
    expect(confidence).toBe("low");
  });

  it("expiry engine flags expired / pre-submission / soon / valid", () => {
    expect(expiryBadge("2020-01-01", null).level).toBe("red");
    expect(expiryBadge("2026-06-01", "2026-07-20").level).toBe("red");
    expect(expiryBadge("2026-08-15", "2026-07-20", new Date("2026-07-01T00:00:00Z")).level).toBe("amber");
    expect(expiryBadge("2027-12-31", "2026-07-20").level).toBe("green");
    expect(expiryBadge(null, null).level).toBe("grey");
  });
});

describe("qc + risk", () => {
  it("fails missing years instead of passing", () => {
    const r = runQc(
      { deliverableTitle: "2022, 2023, 2024 audited accounts" },
      { kind: "evidence", label: "a.pdf", text: "audited accounts 2022 2023 with enough surrounding content to be complete" }
    );
    expect(r.verdict).toBe("non_compliant");
    expect(r.action).toMatch(/2024/);
  });

  it("reviews the unknown instead of guessing compliant", () => {
    const r = runQc({ deliverableTitle: "CO2 certificate" },
      { kind: "evidence", label: "x.pdf", text: "a general letter with plenty of words but no recognisable tags at all here" });
    expect(r.verdict).toBe("review");
  });

  it("quotes the reason for critical risk", () => {
    const a = refineRisk("Quote ALL items", "Failure to quote shall lead to disqualification.");
    expect(a.risk).toBe("critical");
    expect(a.reason.length).toBeGreaterThan(10);
  });
});

describe("readiness", () => {
  const item = (over: Partial<Parameters<typeof computeReadiness>[0][number]> = {}) => ({
    deliverable_id: "d", requirement_id: "r", title: "t", owner: "o",
    risk: "mandatory", type: "deliverable", status: "outstanding",
    verdict: "not_reviewed", section: "Technical", req_type: "doc",
    ...over,
  });

  it("weights critical above mandatory and excludes conditional", () => {
    const r = computeReadiness([
      item({ deliverable_id: "a", risk: "critical", verdict: "compliant", status: "received" }),
      item({ deliverable_id: "b", risk: "mandatory", verdict: "not_reviewed", status: "outstanding" }),
      item({ deliverable_id: "c", risk: "conditional", verdict: "not_reviewed", status: "outstanding" }),
    ]);
    // earned 5/8 = 62.5 → 63 (conditional's weight 0 excluded)
    expect(r.percent).toBe(63);
    expect(r.conditional_open.length).toBe(1);
    expect(r.critical_outstanding.length).toBe(0);
  });

  it("lists critical blockers and refuses ready", () => {
    const items = [item({ deliverable_id: "a", risk: "critical", verdict: "non_compliant" })];
    const { groups, ready } = finalReview(items);
    expect(ready).toBe(false);
    expect(groups.find((g) => g.group === "Commercial" || g.group === "Requirements")!.state).not.toBe("pass");
  });
});

describe("mergeExtraction ownership", () => {
  const ext = (over = {}) => ({
    ref: "4.1",
    section: "Technical",
    envelope: "Technical" as const,
    kind: "requirement",
    title: "CVs of the named lead analyst.",
    description: "CVs of the named lead analyst.",
    type: "doc",
    risk: "mandatory",
    risk_reason: "Listed in Mandatory Bid Content.",
    suggested_owner: "HR/Operations",
    source_page: 20,
    source_span: "CVs of the named lead analyst.",
    deliverables: [],
    ...over,
  });

  it("keeps owner empty until a human accepts the suggestion", () => {
    const { reqs } = mergeExtraction([], [], "t1", [ext()], 1);
    expect(reqs[0].owner).toBeNull();
    expect(reqs[0].suggested_owner).toBe("HR/Operations");
  });

  it("resets unconfirmed owners on re-run but keeps hand edits", () => {
    const first = mergeExtraction([], [], "t1", [ext()], 1).reqs;
    const second = mergeExtraction(first, [], "t1", [ext()], 2).reqs;
    expect(second.find((r) => !r.superseded)!.owner).toBeNull();
    const edited = first.map((r) => ({ ...r, owner: "Ada", edited: true }));
    const third = mergeExtraction(edited, [], "t1", [ext()], 3).reqs;
    expect(third.find((r) => !r.superseded)!.owner).toBe("Ada");
  });
});
