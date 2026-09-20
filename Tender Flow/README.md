# TenderFlow

AI-Powered Tender & Bid Management Platform.

> Upload a tender. Understand what is required. Assign it. Collect it. Check it. Submit it.

**Working product name:** TenderFlow
**Product type:** B2B SaaS
**Initial market:** Oil & Gas companies and service providers in Nigeria
**Spec source:** `PRD for TenderFlow.md` (in this folder)

---

## Product Overview

TenderFlow turns complex tender documents (ITT/RFQ, often hundreds of pages) into a structured, collaborative, quality-controlled workflow.

Each tender becomes a **Tender Workspace** containing:

1. Tender Overview
2. Requirements
3. Responsibility Matrix
4. Documents
5. Assignments
6. QC
7. Submission Checklist
8. Activity/History

Example workspace: **Chevron — Provision of Cementing Products and Services**, Submission: 20 July 2026, with readiness %, critical issues, and outstanding requirements tracked in one place.

Product philosophy from the PRD:

> The AI should reduce the Bid Manager's workload without taking away the Bid Manager's control.

That means: AI extracts → human verifies, AI suggests → human assigns, AI matches → human approves, AI detects → human resolves, AI checks → human makes the final submission decision.

## The Problem It Solves

Tender teams today face:

1. **Manual requirement extraction:** Bid managers must read full ITT packages to find every requirement. One requirement can contain multiple evidence items (e.g. CO2, CO7, NOGIC JQS registration, NUPRC certificate).
2. **Poor visibility:** Work is split across email, Teams, WhatsApp, and shared folders. No real-time view of what is received, outstanding, owned, reviewed, missing, or potentially non-compliant.
3. **Repetitive document searching:** The same certificates, policies, profiles, registrations, tax documents, audited accounts, CVs, equipment evidence, and experience documents are searched for on every bid.
4. **Compliance risk:** Having *a document* is not the same as satisfying *the requirement*. Tenders specify years, templates, signatures, formats, and completeness rules (e.g. 3 years of audited accounts: 2022, 2023, 2024; "no changes to COMPANY wording/format"; "failure to quote for ALL items shall lead to disqualification").

## Target Users

**Primary: Tender / Bid Manager**
Needs speed, visibility, control, accurate extraction, easy assignment, document tracking, QC, and submission readiness.

**Secondary: Requirement Owners**
Finance, HSE, HR, Operations, Nigerian Content, Commercial, Technical, Business Development.
They need to see: what do I need to provide, by when, and what exactly is required?

**Secondary: Management**
Needs active tenders, deadlines, readiness, outstanding critical items, risks/issues.

**Secondary: Document / Compliance Administrator**
Maintains the reusable company document library and monitors validity/expiry.

## Core Functionality (as specified in PRD)

The PRD defines 18 features. The core chain is:

**Understand → Assign → Collect → Match → QC → Resolve → Submit**

Key specified capabilities:

- **Tender Intake + Overview:** extract client, title, project, scope, reference, submission/clarification deadlines, meetings, instructions, submission format, and HSE / Financial / Technical / Commercial / Nigerian Content requirements, with source links back to the tender.
- **AI Responsibility Matrix (heart of product):** Section, Requirement, Deliverables/Evidence, Responsible, Due Date, Status, QC, Source. Preserves parent requirement → sub-item relationships.
- **Requirement classification:** document, information, form/template, evidence, action, conditional.
- **Intelligent responsibility assignment:** suggest by department/function, document/category, and previous patterns. Bid Manager accepts/changes.
- **Company Document Library:** central reusable store with name, type, owner, version, issue/expiry dates, department, entity, status.
- **Intelligent Document Matching:** suggest relevant library documents with confidence. Matching is not automatic compliance approval.
- **Document Expiry Monitoring:** flag expiries before submission / during contract period, plus expiry dashboard.
- **Assignment & Collaboration:** per-person task views, uploads, comments, mark complete, flag issues, deadlines.
- **Automated Follow-Up:** reminders for outstanding/overdue requirements.
- **Intelligent QC + Risk Engine:** check document type, entity, dates/years, completeness, signatures/stamps, forms/templates, inconsistencies, expiry, versions. Statuses: Appears compliant / Review required / Potential non-compliance / Not reviewed. Risk levels: Critical / Mandatory / Conditional / Supporting / Informational, with explanations.
- **Submission Readiness Dashboard + Final Bid QC + Bid Compilation:** readiness %, critical outstanding items, final compliance review, and organizing output into client-required structure.

## Current Development Status

**Status: PRD stage — no implementation yet.**

What exists in this repo today:

- `Tender Flow/PRD for TenderFlow.md` — full product requirements (30 sections, MVP scope, end-to-end workflow example)
- `Tender Flow/README.md` — this file

What does **not** exist yet:

- No application code (frontend / backend)
- No AI pipeline, database, auth, or hosting setup
- No tests, build scripts, or deployment config
- No runnable app

This README therefore describes the **specified** product, not an implemented one.

## Planned / Future Features

### MVP scope (from PRD §25)

1. Tender Upload
2. AI Tender Overview
3. AI Requirement Extraction
4. Responsibility Matrix
5. Parent Requirement + Sub-items
6. AI Suggested Responsibility
7. Document Upload / Collection
8. Company Document Library
9. AI Document Matching
10. Requirement-Level QC
11. Submission Readiness Dashboard
12. Final Compliance Checklist

### Explicitly not MVP (from PRD §26)

Complex commercial pricing, full CRM, procurement / contract management, invoicing, project execution, sophisticated analytics, extensive external integrations, broad multi-industry support.

### Longer-term ideas (from PRD)

Tender templates, tender history / institutional memory, reuse from previous bids ("similar to 4 previous tenders"), management dashboard across tenders, tender intelligence queries (e.g. expiring documents, repeated requirements, department bottlenecks, past QC issues).

## Project Structure

```text
.
├── Tender Flow/
│   ├── PRD for TenderFlow.md
│   └── README.md
└── .gitignore  # ignores unrelated local `French game/` folder
```

## Running the Project Locally

There is currently no code to run. To review the product definition:

```powershell
# 1. Clone (do not push unless requested)
git clone https://github.com/OnealCodes/Qubators-Tender-Flow.git
Set-Location -LiteralPath "Qubators-Tender-Flow"

# 2. Read the spec
notepad "Tender Flow\PRD for TenderFlow.md"
notepad "Tender Flow\README.md"

# 3. Check git status
git status
```

Once implementation starts, this section should be updated with prerequisites, install, env vars, and start commands.

## Next Steps for Implementation

- [ ] Decide stack (frontend, backend, DB, AI services, file storage)
- [ ] Add project scaffolding + `.gitignore` + license
- [ ] Define data model for Tender, Requirement/Sub-item, Assignment, Document, QC Result
- [ ] Build MVP slice 1–6 (upload → matrix)
- [ ] Build MVP slice 7–12 (library → readiness)

## License

No license file yet. Add one before public release.
