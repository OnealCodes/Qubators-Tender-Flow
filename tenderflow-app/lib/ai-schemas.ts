// Versioned AI JSON contracts — types + JSON Schemas, no runtime deps.
// Prompts are versioned alongside: extract/v1, qc/v1 (see ADR-004).
// The app must validate model output against these schemas and reject
// anything that does not parse. No AI is called yet (Phase 3+).
//
// Phase 1 (extraction v2 foundations): adds a FLAT extract/v2 contract.
// Flat = top-level rows array; each row holds only scalars plus ONE
// flat details array of {type, value, unit} objects. No nested parents,
// no free-form JSON. v1 is untouched; nothing in the live flow uses v2 yet.

export type RequirementType =
  | "doc" | "info" | "form" | "evidence" | "action" | "conditional";

export type RiskLevel =
  | "critical" | "mandatory" | "conditional" | "supporting" | "info";

export type QcVerdict =
  | "compliant" | "review" | "non_compliant" | "not_reviewed";

export interface ExtractDeliverableV1 {
  title: string;
  expected_detail?: string;
}

export interface ExtractRequirementV1 {
  title: string;
  description?: string;
  type: RequirementType;
  risk: RiskLevel;
  risk_reason: string;
  section_id?: string;
  source_page: number;
  source_span?: string;
  deliverables: ExtractDeliverableV1[];
}

export interface ExtractOutputV1 {
  version: "extract/v1";
  tender_ref?: string;
  requirements: ExtractRequirementV1[];
}

export interface QcCheckV1 {
  label: string;
  pass: boolean;
  detail?: string;
}

export interface QcOutputV1 {
  version: "qc/v1";
  deliverable_id: string;
  upload_id: string;
  verdict: QcVerdict;
  checks: QcCheckV1[];
  action?: string;
}

export const extractSchemaV1 = {
  $id: "tenderflow/extract/v1",
  type: "object",
  required: ["version", "requirements"],
  properties: {
    version: { const: "extract/v1" },
    tender_ref: { type: "string" },
    requirements: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "type", "risk", "risk_reason", "source_page", "deliverables"],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string" },
          type: { enum: ["doc", "info", "form", "evidence", "action", "conditional"] },
          risk: { enum: ["critical", "mandatory", "conditional", "supporting", "info"] },
          risk_reason: { type: "string", minLength: 1 },
          section_id: { type: "string" },
          source_page: { type: "integer", minimum: 1 },
          source_span: { type: "string" },
          deliverables: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["title"],
              properties: {
                title: { type: "string", minLength: 1 },
                expected_detail: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const qcSchemaV1 = {
  $id: "tenderflow/qc/v1",
  type: "object",
  required: ["version", "deliverable_id", "upload_id", "verdict", "checks"],
  properties: {
    version: { const: "qc/v1" },
    deliverable_id: { type: "string", minLength: 1 },
    upload_id: { type: "string", minLength: 1 },
    verdict: { enum: ["compliant", "review", "non_compliant", "not_reviewed"] },
    checks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["label", "pass"],
        properties: {
          label: { type: "string", minLength: 1 },
          pass: { type: "boolean" },
          detail: { type: "string" },
        },
      },
    },
    action: { type: "string" },
  },
} as const;

// ---------- extract/v2 (flat, Phase 1 foundations — not used by live flow yet) ----------

export type SubmissionClass =
  | "bid_submission" | "commercial" | "evaluation" | "post_award" | "informational";

export type Obligation =
  | "mandatory" | "conditional" | "optional" | "informational";

export type DetailType =
  | "evidence" | "year" | "threshold" | "sensitivity" | "quantity"
  | "person" | "equipment" | "rate" | "document";

// One flat supporting detail. value/unit stay strings so the model cannot
// invent nested structure; deterministic validation checks value ⊆ source.
export interface ExtractDetailV2 {
  type: DetailType;
  value: string;
  unit?: string;
}

export interface ExtractRowV2 {
  ref: string | null;
  section: string;
  display_title: string;
  source_text: string;
  context?: string;
  details: ExtractDetailV2[];
  class: SubmissionClass;
  obligation: Obligation;
  applicability_condition?: string | null;
  is_fatal_flaw?: boolean;
  fatal_flaw_quote?: string | null;
  confidence?: number | null;
  source_page?: number | null;
}

export interface ExtractOutputV2 {
  version: "extract/v2";
  prompt_version: string;
  rows: ExtractRowV2[];
}

export const PROMPT_VERSION_V2 = "extract-prompt/v2";
export const SCHEMA_VERSION_V2 = "extract/v2";

export const extractSchemaV2 = {
  $id: "tenderflow/extract/v2",
  type: "object",
  required: ["version", "prompt_version", "rows"],
  properties: {
    version: { const: "extract/v2" },
    prompt_version: { type: "string", minLength: 1 },
    rows: {
      type: "array",
      items: {
        type: "object",
        required: ["section", "display_title", "source_text", "details", "class", "obligation"],
        properties: {
          ref: { type: ["string", "null"] },
          section: { type: "string", minLength: 1 },
          display_title: { type: "string", minLength: 1 },
          source_text: { type: "string", minLength: 1 },
          context: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              required: ["type", "value"],
              properties: {
                type: { enum: ["evidence", "year", "threshold", "sensitivity", "quantity", "person", "equipment", "rate", "document"] },
                value: { type: "string", minLength: 1 },
                unit: { type: "string" },
              },
            },
          },
          class: { enum: ["bid_submission", "commercial", "evaluation", "post_award", "informational"] },
          obligation: { enum: ["mandatory", "conditional", "optional", "informational"] },
          applicability_condition: { type: ["string", "null"] },
          is_fatal_flaw: { type: "boolean" },
          fatal_flaw_quote: { type: ["string", "null"] },
          confidence: { type: ["number", "null"] },
          source_page: { type: ["integer", "null"] },
        },
      },
    },
  },
} as const;

// Lightweight structural check for v2 payloads (no deps, no throws).
// Live validation (verbatim/fatal/page rules) lands in Phase 2; this only
// guards shape so unit tests + future callers share one definition.
export function validateExtractV2(payload: unknown): string[] {
  const errors: string[] = [];
  if (typeof payload !== "object" || payload === null) return ["payload must be an object"];
  const p = payload as Record<string, unknown>;
  if (p.version !== "extract/v2") errors.push("version must be 'extract/v2'");
  if (typeof p.prompt_version !== "string" || !p.prompt_version) errors.push("prompt_version required");
  if (!Array.isArray(p.rows)) {
    errors.push("rows must be an array");
    return errors;
  }
  const classes = ["bid_submission", "commercial", "evaluation", "post_award", "informational"];
  const obligations = ["mandatory", "conditional", "optional", "informational"];
  const detailTypes = ["evidence", "year", "threshold", "sensitivity", "quantity", "person", "equipment", "rate", "document"];
  p.rows.forEach((r: unknown, i: number) => {
    const row = r as Record<string, unknown>;
    if (typeof row.section !== "string" || !row.section) errors.push(`rows[${i}].section required`);
    if (typeof row.display_title !== "string" || !row.display_title) errors.push(`rows[${i}].display_title required`);
    if (typeof row.source_text !== "string" || !row.source_text) errors.push(`rows[${i}].source_text required`);
    if (!Array.isArray(row.details)) errors.push(`rows[${i}].details must be an array`);
    else row.details.forEach((d: unknown, j: number) => {
      const det = d as Record<string, unknown>;
      if (!detailTypes.includes(det.type as string)) errors.push(`rows[${i}].details[${j}].type invalid`);
      if (typeof det.value !== "string" || !det.value) errors.push(`rows[${i}].details[${j}].value required`);
    });
    if (!classes.includes(row.class as string)) errors.push(`rows[${i}].class invalid`);
    if (!obligations.includes(row.obligation as string)) errors.push(`rows[${i}].obligation invalid`);
  });
  return errors;
}
