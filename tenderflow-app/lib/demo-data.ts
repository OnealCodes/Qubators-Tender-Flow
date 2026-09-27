// Demo data only — mirrors design.html so the Phase 0 shell is testable
// before any backend exists. Each section is labelled DEMO in the UI.
// Real tables (PostgreSQL): tenders, requirements, deliverables,
// assignments, library_docs, uploads, qc_results, activities.

export type QcVerdict = "compliant" | "review" | "non_compliant" | "not_reviewed";

export interface SubItem {
  title: string;
  detail: string;
  owner: string;
  due: string;
  status: string;
  statusTone: "green" | "amber" | "grey";
  qc: string;
  qcTone: "green" | "amber" | "red" | "grey";
  source: string;
}

export interface MatrixGroup {
  id: string;
  section: string;
  sectionTone: "purple" | "blue" | "green" | "red";
  title: string;
  subtitle: string;
  owner: string;
  due: string;
  status: string;
  statusTone: "amber" | "green" | "grey";
  qc: string;
  qcTone: "amber" | "green" | "red" | "grey";
  source: string;
  items: SubItem[];
}

export const tender = {
  client: "Chevron",
  title: "Provision of Cementing Products and Services",
  ref: "CHEV-CEM-2026-041",
  clarification: "02 Jul 2026",
  submission: "20 Jul 2026",
  countdown: "24 days",
  format: "Technical + Commercial, PDF + signed forms",
};

export const readiness = [
  { label: "Readiness", value: "72%", sub: "🟢 52 · 🟡 9 · 🔴 4 · ⚪ 13 outstanding" },
  { label: "Critical issues", value: "4", sub: "2 missing years · 1 expiring cert · 1 template rule" },
  { label: "Documents", value: "31 / 44", sub: "Library matches: 12 accepted · 3 rejected" },
  { label: "Assignments", value: "9 owners", sub: "2 overdue · next due 14 Jul (HSE)" },
];

export const matrix: MatrixGroup[] = [
  {
    id: "g1",
    section: "Nigerian Content",
    sectionTone: "purple",
    title: "Nigerian ownership and registration",
    subtitle: "4 deliverables · owner Bisola · conditional logic applies",
    owner: "Bisola",
    due: "15 Jul",
    status: "◐ In progress",
    statusTone: "amber",
    qc: "▲ Review",
    qcTone: "amber",
    source: "Sec 2 · p.14",
    items: [
      { title: "CO2 certificate", detail: "— document", owner: "Bisola", due: "15 Jul", status: "● Received", statusTone: "green", qc: "● Appears compliant", qcTone: "green", source: "Sec 2.1" },
      { title: "CO7 certificate", detail: "— document", owner: "Bisola", due: "15 Jul", status: "● Received", statusTone: "green", qc: "● Appears compliant", qcTone: "green", source: "Sec 2.1" },
      { title: "NOGIC JQS registration", detail: "— evidence", owner: "Bisola", due: "15 Jul", status: "◐ In progress", statusTone: "amber", qc: "○ Not reviewed", qcTone: "grey", source: "Sec 2.2" },
      { title: "NUPRC certificate", detail: "— expires 31 Dec 2026", owner: "Bisola", due: "15 Jul", status: "● Received", statusTone: "green", qc: "▲ Review", qcTone: "amber", source: "Sec 2.3" },
    ],
  },
  {
    id: "g2",
    section: "Financial",
    sectionTone: "blue",
    title: "Audited accounts (3 years)",
    subtitle: "2022, 2023, 2024 · Finance · template + years checked",
    owner: "Finance / Olabanji",
    due: "15 Jul",
    status: "◐ In progress",
    statusTone: "amber",
    qc: "■ Potential issue",
    qcTone: "red",
    source: "Sec 3 · p.22",
    items: [
      { title: "2022 audited accounts", detail: "", owner: "Finance", due: "15 Jul", status: "● Received", statusTone: "green", qc: "● Appears compliant", qcTone: "green", source: "Sec 3.1" },
      { title: "2023 audited accounts", detail: "", owner: "Finance", due: "15 Jul", status: "● Received", statusTone: "green", qc: "● Appears compliant", qcTone: "green", source: "Sec 3.1" },
      { title: "2024 audited accounts", detail: "— missing", owner: "Finance", due: "15 Jul", status: "○ Outstanding", statusTone: "grey", qc: "■ Potential issue", qcTone: "red", source: "Sec 3.1" },
    ],
  },
];

export const singleRows = [
  { section: "HSE", tone: "green" as const, title: "Safety programme + JHA", sub: "Policy, programme, job hazard analysis", owner: "HSE", due: "14 Jul", status: "○ Pending", qc: "○ Not reviewed", source: "HSE · p.31" },
  { section: "Personnel", tone: "blue" as const, title: "Key personnel + organogram + CVs", sub: "Operations · 6 CVs expected", owner: "Operations", due: "15 Jul", status: "● Received", qc: "▲ Review", source: "Sec 4 · p.38" },
  { section: "Commercial", tone: "red" as const, title: "Quote ALL items — disqualification risk", sub: "Critical rule: failure to quote all items leads to disqualification", owner: "Commercial", due: "18 Jul", status: "◐ In progress", qc: "▲ Review", source: "Sec 8 · p.52" },
];

export const qcChecks = [
  { pass: true, text: "Document appears to be an audited financial statement." },
  { pass: true, text: "Company name appears to match bidding entity." },
  { pass: true, text: "2022 accounts found." },
  { pass: true, text: "2023 accounts found." },
  { pass: false, text: "2024 accounts not found — provide missing 2024 accounts before submission." },
];
