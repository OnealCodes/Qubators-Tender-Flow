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
  it("splits CO2/CO7 entities into sub-items under one parent", () => {
    const out = extractRequirements(
      pages("Nigerian Content: Certified true copies of CAC Forms CO2 and CO7 respectively.")
    );
    expect(out.length).toBe(1);
    expect(out[0].deliverables.map((d) => d.title)).toEqual(
      expect.arrayContaining(["CO2 certificate", "CO7 certificate"])
    );
    expect(out[0].section).toBe("Nigerian Content");
  });

  it("year-splits audited accounts", () => {
    const out = extractRequirements(
      pages("Financial: Provide evidence of Three-Years Tax Clearance Certificate (2022, 2023, 2024).")
    );
    expect(out.length).toBe(1);
    expect(out[0].deliverables.length).toBeGreaterThanOrEqual(3);
  });

  it("marks conditional rows so they never count as missing", () => {
    const out = extractRequirements(pages("Provide Parent Company Guarantee if applicable."));
    expect(out[0].type).toBe("conditional");
    expect(out[0].risk).toBe("conditional");
  });

  it("flags disqualification wording as critical with a reason", () => {
    const out = extractRequirements(
      pages("Commercial: failure to quote for ALL items shall lead to disqualification.")
    );
    expect(out[0].risk).toBe("critical");
    expect(out[0].risk_reason.length).toBeGreaterThan(0);
  });

  it("demotes legal boilerplate to supporting without dropping it", () => {
    const out = extractRequirements(
      pages("Tenderers shall maintain confidentiality since disclosure shall neither be construed as granting any rights")
    );
    expect(out.length).toBe(1);
    expect(out[0].risk).toBe("supporting");
  });

  it("dedupes identical segments", () => {
    const seg = "HSE: Tenderers must submit a safety programme before mobilisation.";
    const out = extractRequirements(pages(seg, seg));
    expect(out.length).toBe(1);
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
