// TenderFlow QC eval suite — 20 cases. Run: node scripts/qc-eval.mjs
// Fails (exit 1) on any wrong verdict. False "compliant" fails the suite:
// uncertainty must surface as "review", real problems as "non_compliant".

import { refineRisk, runQc } from "../lib/qc.ts";

let failures = 0;
let falseCompliant = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  if (expected !== "compliant" && actual === "compliant") falseCompliant++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} (got ${actual}, want ${expected})`);
}

const AUDIT = {
  deliverableTitle: "2024 audited accounts",
  expectedDetail: "2022, 2023, 2024 accounts",
  requirementTitle: "Audited accounts (3 years)",
  requirementType: "doc",
  companyEntity: "Demo Company",
};

// years
check("missing-year", runQc({ ...AUDIT, deliverableTitle: "2022, 2023, 2024 audited accounts" },
  { kind: "evidence", label: "a.pdf", text: "Demo Company audited accounts 2022 2023" }).verdict, "non_compliant");
check("all-years", runQc(AUDIT,
  { kind: "evidence", label: "a.pdf", text: "Demo Company audited accounts for the years 2022, 2023 and 2024, duly signed" }).verdict, "compliant");

// entity matching
check("right-doc", runQc({ deliverableTitle: "NUPRC certificate" },
  { kind: "library", label: "n.pdf", text: "NUPRC certificate 2026", expiry: "2027-12-31" }).verdict, "compliant");
check("wrong-doc", runQc({ deliverableTitle: "CO2 certificate" },
  { kind: "library", label: "t.pdf", text: "Tax clearance certificate", expiry: "2027-12-31" }).verdict, "non_compliant");
check("unknown-doc", runQc({ deliverableTitle: "CO2 certificate" },
  { kind: "evidence", label: "scan.pdf", text: "some general letter about services" }).verdict, "review");
check("no-source", runQc({ deliverableTitle: "CO2 certificate" }, { kind: "none", label: "none" }).verdict, "not_reviewed");

// Pin "today" so expiry cases don't rot as real time passes.
const THEN = new Date("2026-07-01T00:00:00Z");

// expiry
check("expired", runQc({ deliverableTitle: "NUPRC certificate" },
  { kind: "library", label: "n.pdf", text: "NUPRC certificate", expiry: "2020-01-01" }, THEN).verdict, "non_compliant");
check("expires-before-submission", runQc({ deliverableTitle: "NUPRC certificate", submissionDeadline: "2026-07-20" },
  { kind: "library", label: "n.pdf", text: "NUPRC certificate", expiry: "2026-06-01" }, THEN).verdict, "non_compliant");
check("expiring-soon", runQc({ deliverableTitle: "NUPRC certificate", submissionDeadline: "2026-07-20" },
  { kind: "library", label: "n.pdf", text: "NUPRC certificate", expiry: "2026-08-15" }, THEN).verdict, "review");
check("valid-expiry", runQc({ deliverableTitle: "NUPRC certificate", submissionDeadline: "2026-07-20" },
  { kind: "library", label: "n.pdf", text: "NUPRC certificate", expiry: "2027-12-31" }, THEN).verdict, "compliant");

// completeness / signatures / forms / company
check("scanned-text", runQc({ deliverableTitle: "NUPRC certificate" },
  { kind: "evidence", label: "scan.pdf", text: "NUPRC" }).verdict, "review");
check("signed", runQc({ deliverableTitle: "Signed NUPRC undertaking letter", requirementTitle: "Sign the undertaking letter", requirementType: "action" },
  { kind: "evidence", label: "u.pdf", text: "signed and stamped NUPRC undertaking letter with full content padded to sufficient length" }).verdict, "compliant");
check("unsigned", runQc({ deliverableTitle: "Signed NUPRC undertaking letter", requirementTitle: "Sign the undertaking letter", requirementType: "action" },
  { kind: "evidence", label: "u.pdf", text: "NUPRC undertaking letter content here with sufficient length to pass completeness checks easily" }).verdict, "review");
check("form-filled", runQc({ deliverableTitle: "Compliance questionnaire", requirementType: "form" },
  { kind: "evidence", label: "q.pdf", text: "questionnaire answers ".repeat(30) }).verdict, "review");
check("company-mismatch", runQc({ deliverableTitle: "NUPRC certificate", companyEntity: "Demo Company" },
  { kind: "library", label: "n.pdf", text: "NUPRC certificate for Other Ltd", expiry: "2027-12-31" }).verdict, "review");

// risk engine
check("risk-critical", refineRisk("Quote ALL items", "Failure to quote for ALL items shall lead to disqualification.").risk, "critical");
check("risk-conditional", refineRisk("Parent Company Guarantee", "Provide PCG if applicable.").risk, "conditional");
check("risk-mandatory", refineRisk("Audited accounts", "Tenderers must submit three years accounts.").risk, "mandatory");
check("risk-supporting", refineRisk("Extra brochures", "Tenderers may include supporting brochures.").risk, "supporting");
check("risk-default", refineRisk("Safety programme", "Provide a safety programme.").risk, "mandatory");

console.log(`\n${20 - failures}/20 passed · false-compliant: ${falseCompliant}`);
process.exit(failures > 0 ? 1 : 0);
