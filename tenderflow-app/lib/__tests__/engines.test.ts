// Engine unit tests — run: npm test (vitest run). Pure functions only,
// no database, no network. Guards the behaviour proven on real ITTs.
import { describe, expect, it } from "vitest";
import { extractRequirements } from "../extract";
import { expiryBadge, scoreMatch } from "../matching";
import { refineRisk, runQc } from "../qc";
import { computeReadiness, finalReview } from "../readiness";

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
});

describe("matching", () => {
  const doc = (name: string, extra = {}) => ({
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
