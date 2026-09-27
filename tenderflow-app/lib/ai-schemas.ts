// Versioned AI JSON contracts — types + JSON Schemas, no runtime deps.
// Prompts are versioned alongside: extract/v1, qc/v1 (see ADR-004).
// The app must validate model output against these schemas and reject
// anything that does not parse. No AI is called yet (Phase 3+).

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
