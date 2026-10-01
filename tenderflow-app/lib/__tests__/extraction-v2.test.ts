// Phase 1 foundations — v2 contract + stable_key. Pure functions only,
// no database, no network, no live Gemini calls. Run: npm test.
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION_V2,
  validateExtractV2,
} from "../ai-schemas";
import { stableKeyFor } from "../requirements";

const row = (over = {}) => ({
  ref: "2.3.1",
  section: "Scope Drivers",
  display_title: "Design life 10-yr base case",
  source_text: "Adopt a nominal structural design life of 10 years.",
  details: [{ type: "threshold", value: "10-year nominal life" }],
  class: "bid_submission",
  obligation: "mandatory",
  ...over,
});

const payload = (rows: unknown[], over = {}) => ({
  version: "extract/v2",
  prompt_version: "extract-prompt/v2",
  rows,
  ...over,
});

describe("extract/v2 flat contract", () => {
  it("accepts a minimal valid payload with threshold detail", () => {
    expect(validateExtractV2(payload([row()]))).toEqual([]);
  });

  it("accepts sensitivity details and null source_page (flagged later, not hard-fail)", () => {
    const p = payload([
      row({
        details: [{ type: "sensitivity", value: "3, 5, 10 and 15 years" }],
        source_page: null,
      }),
    ]);
    expect(validateExtractV2(p)).toEqual([]);
  });

  it("accepts all nine detail types including threshold + sensitivity", () => {
    const types = ["evidence", "year", "threshold", "sensitivity", "quantity", "person", "equipment", "rate", "document"];
    const p = payload([
      row({ details: types.map((type) => ({ type, value: "x" })) }),
    ]);
    expect(validateExtractV2(p)).toEqual([]);
  });

  it("rejects bad class, obligation and detail type", () => {
    const errors = validateExtractV2(
      payload([row({ class: "urgent", obligation: "maybe", details: [{ type: "vibes", value: "x" }] })])
    );
    expect(errors.join(" ")).toMatch(/class invalid/);
    expect(errors.join(" ")).toMatch(/obligation invalid/);
    expect(errors.join(" ")).toMatch(/details\[0\]\.type invalid/);
  });

  it("rejects missing display_title / source_text and wrong version", () => {
    const errors = validateExtractV2(payload([{ ...row(), display_title: "", source_text: "" }]));
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(validateExtractV2(payload([row()], { version: "extract/v1" }))).toContain(
      "version must be 'extract/v2'"
    );
  });

  it("exposes the schema version constant", () => {
    expect(SCHEMA_VERSION_V2).toBe("extract/v2");
  });
});

describe("stableKeyFor", () => {
  it("builds only from ref + section + start of normalised source", () => {
    const a = stableKeyFor("4.1", "Technical", "Method statement per Section 2.21.");
    const b = stableKeyFor("4.1", "Technical", "Method statement per Section 2.21.");
    expect(a).toBe(b);
    expect(a.length).toBeLessThanOrEqual(120);
  });

  it("survives small wording edits (first 80 chars stable)", () => {
    const base = "Adopt a nominal structural design life of 10 years covering the full credible suspension period including any extension granted by NUPRC";
    const a = stableKeyFor("2.3.1", "Scope", `${base}.`);
    const b = stableKeyFor("2.3.1", "Scope", `${base} beyond the four-year limit.`);
    expect(a).toBe(b);
  });

  it("separates different refs and sections", () => {
    const a = stableKeyFor("4.1", "Technical", "Schedule with critical path.");
    expect(stableKeyFor("4.2", "Technical", "Schedule with critical path.")).not.toBe(a);
    expect(stableKeyFor("4.1", "Commercial", "Schedule with critical path.")).not.toBe(a);
  });

  it("handles null ref/section/source without throwing", () => {
    expect(() => stableKeyFor(null, null, null)).not.toThrow();
    expect(stableKeyFor(null, "Bid", "Tax clearance 2023 - 2025")).toContain("bid");
  });
});
