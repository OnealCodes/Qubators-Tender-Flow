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

// ---- Phase 1 route data (all DEMO) ----

export const buckets = [
  { name: "Technical", count: 47 },
  { name: "Nigerian Content", count: 18 },
  { name: "HSE", count: 7 },
  { name: "Financial", count: 5 },
  { name: "Commercial", count: 6 },
];

export const libraryDocs = [
  { name: "NUPRC Certificate 2026", type: "Registration", version: "v2026", expiry: "31 Dec 2026", status: "Valid", tone: "green" as const },
  { name: "ISO 9001:2015", type: "Certificate", version: "v3", expiry: "12 Oct 2026", status: "Valid", tone: "green" as const },
  { name: "Industrial Insurance Policy", type: "Insurance", version: "v2025-26", expiry: "25 Sep 2026", status: "Expiring soon", tone: "amber" as const },
  { name: "Tax Clearance Certificate", type: "Tax", version: "2024", expiry: "30 Nov 2026", status: "Valid", tone: "green" as const },
  { name: "HSE Policy Manual", type: "Policy", version: "v7", expiry: "—", status: "Valid", tone: "green" as const },
  { name: "Company Profile", type: "Profile", version: "v12", expiry: "—", status: "Valid", tone: "green" as const },
];

export const assignments = [
  { owner: "Oluchi", dept: "Commercial", items: [["Insurance", "Pending"], ["Parent Company Guarantee", "In Progress"], ["Community Engagement Plan", "Received"], ["Contractor Brief Form", "Pending"]] },
  { owner: "Bisola", dept: "Nigerian Content", items: [["CO2", "Received"], ["CO7", "Received"], ["NOGIC JQS", "In Progress"], ["NUPRC certificate", "Received"]] },
  { owner: "Olabanji", dept: "Finance", items: [["2022 accounts", "Received"], ["2023 accounts", "Received"], ["2024 accounts", "Outstanding"], ["Tax clearance", "Received"]] },
  { owner: "HSE team", dept: "HSE", items: [["Safety programme", "Pending"], ["JHA", "Pending"], ["HSE policy", "Received"]] },
];

export const checklistGroups = [
  { group: "Requirements", items: [["Every mandatory requirement addressed?", "In progress"], ["Conditional requirements resolved?", "Review"], ["No outstanding critical items?", "Issue"]] },
  { group: "Documents", items: [["Required documents present?", "In progress"], ["Correct versions in use?", "Review"], ["No expired documents submitted?", "Issue"]] },
  { group: "Content", items: [["Evidence matches requirement?", "Review"], ["Required dates/years covered?", "Issue"]] },
  { group: "Forms", items: [["Required forms completed?", "Pending"], ["Signatures present?", "Pending"], ["Client templates preserved?", "Review"]] },
  { group: "Commercial", items: [["All pricing items quoted?", "In progress"], ["Mandatory commercial templates included?", "Pending"]] },
  { group: "Nigerian Content", items: [["NCDMB/NOGIC documents present?", "In progress"]] },
  { group: "HSE", items: [["HSE policies, records and plans included?", "Pending"]] },
];

export const activity = [
  { time: "09:00", text: "Bid Manager uploaded Chevron_Cementing_ITT.pdf" },
  { time: "09:02", text: "Overview extracted: 83 requirements across 5 buckets" },
  { time: "09:10", text: "Owners suggested and confirmed (9 owners)" },
  { time: "09:15", text: "Library match: NUPRC Certificate 2026 — High confidence — accepted" },
  { time: "11:02", text: "Finance uploaded Audited Accounts.pdf — QC flagged 2024 missing" },
  { time: "14:00", text: "Readiness recomputed: 72% · 4 critical issues · 13 outstanding" },
];
