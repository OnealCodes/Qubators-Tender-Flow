// QC + risk engines — pure functions, deterministic, review-biased.
// Rule 1: never return a false "compliant". Uncertainty → review.
// Rule 2: every verdict ships per-check evidence + a next action.
// The LLM qc/v1 adapter (ADR-004) produces the same shape later.

export type QcVerdict = "compliant" | "review" | "non_compliant" | "not_reviewed";

export interface QcCheck {
  label: string;
  pass: boolean | null; // null = uncertain
  detail: string;
}

export interface QcSource {
  kind: "evidence" | "library" | "text" | "none";
  label: string;
  text?: string;
  fileName?: string;
  expiry?: string | null;
}

export interface QcInput {
  deliverableTitle: string;
  expectedDetail?: string | null;
  requirementTitle?: string | null;
  requirementType?: string | null;
  companyEntity?: string | null;
  submissionDeadline?: string | null;
}

export interface QcResult {
  verdict: QcVerdict;
  checks: QcCheck[];
  action: string;
}

const ENTITY_TAGS: { match: RegExp; tag: string }[] = [
  { match: /\bCO2\b/, tag: "CO2" },
  { match: /\bCO7\b/, tag: "CO7" },
  { match: /NOGIC(\s*JQS)?/i, tag: "NOGIC" },
  { match: /NUPRC/i, tag: "NUPRC" },
  { match: /NCDMB/i, tag: "NCDMB" },
  { match: /ISO\s*9001/i, tag: "ISO9001" },
  { match: /tax clearance/i, tag: "TAX" },
  { match: /insurance/i, tag: "INSURANCE" },
  { match: /HSE policy/i, tag: "HSE-POLICY" },
  { match: /safety programme/i, tag: "SAFETY" },
  { match: /\bJHA\b|job hazard analysis/i, tag: "JHA" },
  { match: /organogram/i, tag: "ORGANOGRAM" },
  { match: /\bCVs?\b/i, tag: "CV" },
  { match: /audit/i, tag: "AUDIT" },
  { match: /company profile/i, tag: "PROFILE" },
  { match: /parent company guarantee/i, tag: "PCG" },
  { match: /bid bond/i, tag: "BOND" },
];

function tagsOf(text: string): Set<string> {
  const tags = new Set<string>();
  for (const e of ENTITY_TAGS) if (e.match.test(text)) tags.add(e.tag);
  return tags;
}

function yearsOf(text: string): string[] {
  return [...new Set([...text.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0]))];
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 3600 * 1000));
}

export function runQc(input: QcInput, source: QcSource, now = new Date()): QcResult {
  const checks: QcCheck[] = [];
  const fail = (label: string, detail: string) => checks.push({ label, pass: false, detail });
  const pass = (label: string, detail: string) => checks.push({ label, pass: true, detail });
  const unsure = (label: string, detail: string) => checks.push({ label, pass: null, detail });

  if (source.kind === "none") {
    return {
      verdict: "not_reviewed",
      checks: [{ label: "Evidence present", pass: false, detail: "No evidence uploaded and no library document accepted yet." }],
      action: "Upload evidence or accept a library match first.",
    };
  }

  const hay = `${source.text ?? ""} ${source.fileName ?? ""}`;
  // Tags come from the deliverable's own title only: surrounding context
  // may mention sibling entities (e.g. NOGIC next to NUPRC) and must not
  // dilute the check. Years still consider title + detail.
  const wantTags = tagsOf(input.deliverableTitle);
  const gotTags = tagsOf(hay);

  // 1. Document-type check: right document, or clearly a different one?
  if (wantTags.size === 0) {
    unsure("Document type", "No recognisable document tag in the requirement — verify manually that this is the right file.");
  } else {
    const shared = [...wantTags].filter((t) => gotTags.has(t));
    const foreign = [...gotTags].filter((t) => !wantTags.has(t));
    if (shared.length === wantTags.size) {
      pass("Document type", `Expected tag${shared.length > 1 ? "s" : ""} found: ${shared.join(", ")}.`);
    } else if (shared.length > 0) {
      unsure("Document type", `Partially matches (${shared.join(", ")}); confirm the file covers the full requirement.`);
    } else if (foreign.length > 0) {
      fail("Document type", `Looks like a different document (${foreign.join(", ")}) — expected ${[...wantTags].join(", ")}.`);
    } else {
      unsure("Document type", `Could not confirm ${[...wantTags].join(", ")} in the file — verify manually.`);
    }
  }

  // 2. Required years (e.g. audited accounts 2022–2024).
  const wantYears = yearsOf(`${input.deliverableTitle} ${input.expectedDetail ?? ""}`);
  if (wantYears.length > 0) {
    const gotYears = yearsOf(hay);
    const missing = wantYears.filter((y) => !gotYears.includes(y));
    if (missing.length === 0) pass("Required years", `All required years covered: ${wantYears.join(", ")}.`);
    else fail("Required years", `${missing.join(", ")} not found in the file. Provide the missing ${missing.length > 1 ? "years" : "year"}.`);
  }

  // 3. Expiry (library documents carry expiry dates).
  if (source.expiry) {
    const exp = new Date(source.expiry);
    if (isNaN(exp.getTime())) {
      unsure("Expiry", `Expiry date "${source.expiry}" is unreadable — verify manually.`);
    } else if (exp.getTime() < now.getTime()) {
      fail("Expiry", `Document expired ${source.expiry} — a current document is required.`);
    } else if (input.submissionDeadline) {
      const sub = new Date(input.submissionDeadline);
      if (!isNaN(sub.getTime()) && exp.getTime() < sub.getTime()) {
        fail("Expiry", `Expires ${source.expiry}, before the submission date — replace it.`);
      } else if (!isNaN(sub.getTime()) && daysBetween(sub, exp) < 90) {
        unsure("Expiry", `Expires ${source.expiry}, within 90 days after submission — confirm it covers the contract period.`);
      } else {
        pass("Expiry", `Valid to ${source.expiry}.`);
      }
    } else if (daysBetween(now, exp) < 60) {
      unsure("Expiry", `Expires soon (${source.expiry}) — confirm it stays valid.`);
    } else {
      pass("Expiry", `Valid to ${source.expiry}.`);
    }
  }

  // 4. Company/entity consistency.
  if (input.companyEntity) {
    if (hay.toLowerCase().includes(input.companyEntity.toLowerCase())) {
      pass("Company match", "Bidding entity named in the file.");
    } else {
      unsure("Company match", "Bidding entity not found in the extractable text — confirm the document belongs to the bidding entity.");
    }
  }

  // 5. Signatures/stamps for action-type requirements.
  if (/sign|stamp|notariz|sworn/i.test(`${input.requirementTitle ?? ""} ${input.deliverableTitle}`)) {
    if (/sign|stamp|seal|sworn|notar/i.test(hay)) pass("Signatures", "Signature/stamp wording detected.");
    else unsure("Signatures", "No signature/stamp wording detected — confirm the file is signed and stamped.");
  }

  // 6. Template completion for form-type requirements.
  if (input.requirementType === "form") {
    const len = (source.text ?? "").length;
    if (len > 200) pass("Form completion", "Form appears filled in.");
    else unsure("Form completion", "Could not confirm the form is completed — open it and check.");
  }

  // 7. Completeness: too little extractable text means we cannot judge.
  const textLen = (source.text ?? "").length;
  if (source.kind === "evidence" && textLen < 50) {
    unsure("Completeness", "Very little extractable text (scanned/image file?) — verify the content manually.");
  }

  const failed = checks.filter((c) => c.pass === false);
  const uncertain = checks.filter((c) => c.pass === null);
  if (failed.length > 0) {
    return { verdict: "non_compliant", checks, action: `Action: ${failed[0].detail}` };
  }
  if (uncertain.length > 0) {
    return { verdict: "review", checks, action: `Review: ${uncertain[0].detail}` };
  }
  return { verdict: "compliant", checks, action: "No action needed — evidence appears to satisfy the requirement." };
}

// ---------- risk engine v1: rules decide, LLM assists later ----------

export interface RiskAssessment {
  risk: string;
  reason: string;
}

export function refineRisk(title: string, description?: string | null): RiskAssessment {
  const text = `${title} ${description ?? ""}`;
  const quote = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? `Matched: "${m[0].slice(0, 80)}".` : null;
  };
  if (/if (applicable|any|required)|where applicable|where relevant/i.test(text)) {
    return { risk: "conditional", reason: "Applies only under stated conditions — excluded from missing counts." };
  }
  const crit = quote(/[^.]{0,60}disqualif[^.]{0,40}|[^.]{0,60}invalidat[^.]{0,40}|fatal flaw|will not be considered|will not be evaluated|shall be rejected|will be rejected|no changes? (to|of)[^.]{0,40}|no alteration/i);
  if (crit) return { risk: "critical", reason: `${crit} Failure here can reject the bid.` };
  if (/\bmust\b|\bshall\b|mandatory|required|compulsory/i.test(text)) {
    return { risk: "mandatory", reason: "Stated with must/shall/required wording." };
  }
  if (/\bmay\b|\bshould\b|recommended|supporting|advantage/i.test(text)) {
    return { risk: "supporting", reason: "Supporting wording (may/should) — useful but not a bid-killer." };
  }
  return { risk: "mandatory", reason: "Stated as a requirement without explicit criticality." };
}
