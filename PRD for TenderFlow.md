# **Product Requirements Document (PRD)**

## **AI-Powered Tender & Bid Management Platform**

**Working product name:** TenderFlow  
&nbsp;**Product type:** B2B SaaS  
&nbsp;**Initial market:** Oil & Gas companies and service providers in Nigeria  
&nbsp;**Primary user:** Tender/Bid Manager  
&nbsp;**Secondary users:** Technical, HSE, Finance, Nigerian Content, HR, Operations, Commercial and Management teams

---

> **Evaluator Note — Database and Cost Decision (2026-09-26, owner-approved)**
>
> * **PostgreSQL was selected** as the database for TenderFlow from the beginning.
> * **PostgreSQL will run locally using Docker** when implementation reaches the database setup phase. No Supabase or other hosted database will be used for the current stage. The application and database remain local; deployment is not part of the current stage.
> * **Why PostgreSQL instead of SQLite:** TenderFlow will hold strongly related data (tenders, requirements, sub-items, assignments, documents, QC results, users, statuses, activity history, document matching). Using the production-suitable relational database from the start avoids a later SQLite → PostgreSQL migration.
> * **Free/open-source and low-cost priority:** the project prefers free/open-source tools and local development wherever practical. File storage for MVP is a local project `uploads/` folder. Cloudflare R2 may only be evaluated later as a low-cost option if required.
> * **No unnecessary paid services:** paid accounts, subscriptions, or billable cloud resources will not be introduced without explicit owner approval.

---

> **Evaluator Note — Task 2 Design Refinement (2026-09-27, design.html preview only)**
>
> * **What was requested/made:** one deliberate usability refinement to the standalone `design.html` preview — improved requirements-matrix readability.
> * **What was changed in `design.html`:** increased table cell padding and line-height, stronger parent-row separation with zebra shading for sub-rows, sticky header with higher-contrast background plus shadow, and bolder status/QC badges that always combine icon + text with bordered contrast (never colour alone).
> * **Why it improves the design:** bid managers scan 80+ rows under deadline pressure; clearer row separation, a persistent high-contrast header, and icon-plus-text badges reduce misreading of status/QC, improve contrast for low-vision users, and preserve visual hierarchy on wide B2B tables.

---

> **Evaluator Note — Design Theme Update (2026-09-27, design.html preview only)**
>
> * **What was requested:** style the `design.html` preview with the colours and background feel of the company website (deep navy, gold accent, dark ocean-style hero band).
> * **What was changed in `design.html`:** navy deepened to `#0A2C4E`/`#071F36` with subtle circular pattern, accent switched from teal to gold `#F5B301`, primary buttons use primary blue `#1D4C8D`, new dark gradient hero band behind the tender title with gold eyebrow bar and quote marks. QC green/amber/red semantics unchanged. Preview remains self-contained with demonstration data only.
> * **Branding correction:** all visible DexterPro wording was removed from the preview (sidebar subtitle, palette heading, swatch label renamed to Primary Blue). The preview keeps the colour inspiration but carries TenderFlow branding only.

---

> **Evaluator Note — Sample Data Status (2026-09-27, owner-confirmed)**
>
> * The Chevron tender appearing in this PRD, in `design.html`, and in the app is an **illustrative sample only** — it reflects how the owner used to lay out a responsibility matrix by hand. **No real tender document was supplied when this PRD was written**, and nothing labelled Chevron here should be treated as a real ITT.
> * All extraction, matching and QC behaviour so far is verified against a small generated fixture, not a production tender. Precision claims await real documents.
> * **Real tender samples still needed (for Phase 9 evaluation/pilot):** 2–3 sanitised ITT/RFQ PDFs (any client, personal/client-sensitive pages removed) plus 10–15 reusable company documents (registrations, certificates, policies, CVs, audited accounts, HSE docs). These tune extraction coverage, matching precision and QC false-positive rates, and serve as golden eval fixtures. The owner will provide them when asked — requested now, to unblock Phase 9.
>
> * **Update 2026-09-27 — first real samples received:** Renaissance IT Support Services Package 2 invitation letter (CW662877) with the owner's hand-drafted responsibility matrix (Statutory, Corporate, Financial, HSE, Technical C1/C2/C4, Nigerian Content, Health, Commercial sections with named owners), Renaissance Drilling Tools & Equipment Rental ITT excerpts (CW62716, incl. Appendix A questionnaire structure and Section A–E/Nigerian Content tables), and Chevron Electric Line Through Tubing ITT excerpts (CNL.00000353, incl. HSE questionnaire, organogram/CV table, R&D MOA, monthly-reporting clauses). No company-confidential evidence documents shared (correctly withheld). Files to be stored local-only as golden fixtures, never committed.

---

> **Evaluator Note — Responsible AI, Ethics & Corporate Readiness (2026-09-30, owner-directed)**
>
> Five principles, how TenderFlow honours each, and what remains:
>
> * **Fairness.** The product organises bids; it never scores bidders or picks winners, so there is no automated decision to discriminate. Watch-point carried forward: owner suggestions learn from history and could entrench who always gets picked — mitigated because suggestions display with reasons and a human must Accept/Change; suggestion-acceptance rates will be audited before any pilot scale-up.
> * **Accountability.** Every AI output is a suggestion: extraction rows are human-verified, matches require Accept, QC overrides require a written reason, readiness never auto-submits, and the audit trail records who decided what. Responsibility in a bid always sits with the named Bid Manager, never the tool.
> * **Transparency.** AI rows are badged with model, source section and page; keep/drop suggestions ship reasons; the landing page states plainly what the AI does. No silent automation exists in the product.
> * **Privacy.** Tenders live in the customer's own local database (NDPR-aligned: minimisation, local retention, hard delete incl. files). Only bid-content sections — never whole archives — are sent to the AI provider; nothing trains on customer data; a per-tender rules-only mode (`?ai=off` + workspace toggle) makes zero external calls. CVs/personal data in tenders are therefore never transmitted unless inside an extracted bid section, and reviewers are told this.
> * **Safety (fail-closed).** Uncertainty resolves to Review, never false-Compliant; hallucinated rows are rejected by verbatim verification before reaching the matrix; if the AI service is down or unconfigured, the rules engine carries on alone. Worst case of a miss is an outstanding item a human still reviews — never an auto-submitted bid.
>
> African-builders questions, answered for evaluators:
>
> * **Data sovereignty.** Default posture is sovereign: Postgres + files on the customer's own machine under their own law. The only cross-border flow is optional Gemini calls (bid sections only, key-holder's Google terms); rules-only mode removes even that.
> * **Language.** English-only today, stated openly, never implied otherwise. Tender wording is kept verbatim precisely so nothing is lost in translation; additional languages are a post-MVP RFC, not a silent gap.
> * **Community decision-making.** The workflow mirrors how bid teams actually work (Bid Manager proposes, owners provide, management signs off) instead of imposing an approval chain from elsewhere; roles stay at Manager/Contributor until a customer asks otherwise.
> * **Dependency.** If the AI provider shuts off access tomorrow, the product keeps working: heuristics, matching rules, QC checks, readiness and compilation are all local. Vendor-specific code is isolated in one adapter file (`lib/gemini.ts`) behind versioned JSON contracts, so providers are swappable.
>
> Underestimated risks, handled:
>
> * **Bias** — no bidder scoring exists to scale bias; suggestion patterns stay human-gated.
> * **Hallucination** — verbatim verification + human verify gates; harm requires two humans to look away.
> * **Surveillance** — activity logs track tender actions by named bid-team users for audit, not people; no behavioural monitoring, no hidden telemetry.
> * **Displacement** — product positioning is task relief (reading drudgery), with authority explicitly retained by named humans; pilot guidance frames it that way.
> * **Consent** — AI use is labelled everywhere it acts, with a per-tender off switch; customers consent by enabling a key they own and can revoke.
>
> Corporate-sale readiness (gaps tracked, not hidden): authentication/authorisation (Better Auth, ADR-002 — next build), DPA template + NDPR mapping doc, TLS/backup/restore runbook for any networked deployment, licence file, onboarding guide. Present today: audit export, full delete incl. files, local backups with restore drills, rate limits, upload dedup.

---

# **1\. Product Vision**

Create a platform that transforms the tendering process from a largely manual, document-reading exercise into a **structured, collaborative and quality-controlled workflow**.

Today, a bid manager may need to:

1. Receive a tender.  
2. Read hundreds of pages of ITT/RFQ documents.  
3. Identify every requirement.  
4. Create a responsibility matrix manually.  
5. Determine who should provide each requirement.  
6. Send requests to different departments.  
7. Chase people for documents.  
8. Search through existing company documents.  
9. Compile responses.  
10. Check whether every requirement has been addressed.  
11. Check whether submitted documents actually satisfy the tender requirements.  
12. Compile the final bid in the client's required format.  
13. Perform a final compliance check before submission.

The platform should bring these activities into **one tender workspace**.

### **Core product promise**

> **Upload a tender. Understand what is required. Assign it. Collect it. Check it. Submit it.**

---

# **2\. Problem Statement**

Tender teams face several recurring problems:

### **Manual requirement extraction**

Bid managers have to read tender documents and manually identify requirements.

A single requirement may contain multiple pieces of evidence or actions.

For example, a tender might request:

* CO2  
* CO7  
* NOGIC JQS registration  
* NUPRC certificate

These are logically connected to one requirement but are separate pieces of evidence.

### **Poor visibility**

Once requirements have been distributed across emails, Teams, WhatsApp and shared folders, the bid manager may not have a reliable real-time picture of:

* What has been received?  
* What is still outstanding?  
* Who is responsible?  
* What has been reviewed?  
* What is missing?  
* What is potentially non-compliant?

### **Repetitive document searching**

Companies repeatedly submit documents such as:

* certificates  
* policies  
* company profiles  
* registrations  
* tax documents  
* audited accounts  
* CVs  
* equipment evidence  
* experience documents

Finding the correct version can itself consume considerable time.

### **Compliance risk**

Having *a document* is not necessarily the same as satisfying *the requirement*.

For example, a tender can specify particular financial years, evidence types, templates or signatures. The supplied Chevron example includes specific requirements for three years of audited accounts and tax clearance.

---

# **3\. Target Users**

## **Primary: Tender/Bid Manager**

Responsible for coordinating the entire tender.

Needs:

* speed  
* visibility  
* control  
* accurate requirement extraction  
* easy assignment  
* document tracking  
* QC  
* submission readiness

## **Secondary: Requirement Owner**

Examples:

* Finance  
* HSE  
* HR  
* Operations  
* Nigerian Content  
* Commercial  
* Technical  
* Business Development

They primarily need to see:

> **What do I need to provide, by when, and what exactly is required?**

## **Secondary: Management**

Needs a high-level view:

* number of active tenders  
* submission deadlines  
* overall readiness  
* outstanding critical requirements  
* risks/issues

## **Secondary: Document/Compliance Administrator**

Needs to maintain the company's reusable document library and monitor document validity.

---

# **4\. Core Product Concept**

Each tender becomes a **Tender Workspace**.

Example:

> **Chevron — Provision of Cementing Products and Services**

> Submission: 20 July 2026  
> &nbsp;Status: 72% Ready  
> &nbsp;Critical Issues: 4  
> &nbsp;Outstanding Requirements: 13

The workspace contains:

1. Tender Overview  
2. Requirements  
3. Responsibility Matrix  
4. Documents  
5. Assignments  
6. QC  
7. Submission Checklist  
8. Activity/History

---

# **5\. Feature 1 — Tender Intake**

The user uploads the tender package.

The platform should identify and organize the relevant tender information.

### **Tender Overview**

Automatically extract:

* Client  
* Tender title  
* Project  
* Scope  
* Tender reference  
* Submission deadline  
* Clarification deadline  
* Clarification meeting  
* Important instructions  
* Required submission format  
* Key tender documents  
* Major compliance requirements  
* Commercial requirements  
* Nigerian Content requirements  
* HSE requirements  
* Financial requirements  
* Technical requirements

The example matrix itself begins with project information, scope, clarification meeting and submission date.

### **Important feature**

Every extracted requirement should retain a **link back to its source in the tender**.

The bid manager should be able to ask:

> "Where did the platform get this requirement from?"

and immediately see the relevant tender section/page.

---

# **6\. Feature 2 — AI Responsibility Matrix**

This is the **heart of the product**.

The platform automatically converts tender requirements into a structured responsibility matrix.

### **Recommended structure**

| Section | Requirement | Deliverables/Evidence | Responsible | Due Date | Status | QC | Source |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Financial | Audited Accounts | 2022, 2023, 2024 accounts | Finance | 15 Jul | In Progress | — | Section 3 |
| Nigerian Content | Ownership evidence | CO2, CO7, NOGIC JQS, NUPRC | Bisola | 15 Jul | In Progress | — | Section 2 |
| HSE | Safety documentation | Safety programme, policies, JHA | HSE | 14 Jul | Pending | — | HSE |
| Personnel | Key personnel | Organogram \+ CVs | Operations | 15 Jul | Received | Review | Section 4 |

The platform should preserve the **parent requirement/sub-item relationship**.

### **Example**

**Parent requirement:**

> Nigerian ownership and registration

**Owner:** Bisola

**Sub-items:**

* CO2  
* CO7  
* NOGIC JQS  
* NUPRC certificate

Each sub-item can have its own status, while the entire requirement remains owned by Bisola.

---

# **7\. Requirement Classification**

The AI should classify requirements into useful categories.

### **Document requirement**

> Provide valid ISO certificate.

### **Information requirement**

> Provide company experience and client contact information.

### **Form/template requirement**

> Complete Section 8 Compliance Questionnaire.

### **Evidence requirement**

> Provide invoices, purchase orders or lease documents.

### **Action requirement**

> Sign and submit the undertaking letter.

### **Conditional requirement**

> Provide Parent Company Guarantee **if applicable**.

This is important because conditional requirements should not automatically appear as missing.

---

# **8\. Feature 3 — Intelligent Responsibility Assignment**

The platform should suggest who should handle each requirement.

The recommendation should be based on:

### **Department/function**

Example:

> Audited Accounts → Finance

### **Document/category**

Example:

> CV → HR/Operations

### **Previous assignments**

If similar requirements have historically been assigned to a particular person, the platform can suggest that person.

### **User confirmation**

The Bid Manager remains in control.

Example:

> **Suggested owner:** Finance  
> &nbsp;**Suggested person:** Olabanji  
> &nbsp;\[Accept\] \[Change\]

This avoids forcing the AI to make an irreversible decision.

---

# **9\. Feature 4 — Company Document Library**

The company should have a central repository of reusable tender documents.

Examples:

* ISO certificates  
* NUPRC registration  
* NOGIC JQS  
* tax clearance  
* audited accounts  
* company profile  
* HSE policies  
* insurance documents  
* CVs  
* equipment documents  
* previous project evidence  
* organizational charts  
* Nigerian Content documents

The library should retain useful metadata such as:

* Document name  
* Document type  
* Owner  
* Version  
* Issue date  
* Expiry date  
* Department  
* Applicable entity  
* Status

---

# **10\. Feature 5 — Intelligent Document Matching**

When a requirement is extracted, the platform searches the company's document library.

Example:

> **Requirement:** Provide NUPRC Certificate

The platform responds:

> **Possible matching document found**

> NUPRC Certificate — 2026  
> &nbsp;Expiry: 31 Dec 2026  
> &nbsp;Match confidence: High

> **Use this document?**

The user can accept or reject the suggested document.

### **Important principle**

**Matching is not automatic compliance approval.**

The platform should say:

> "This document appears relevant."

rather than:

> "This requirement is definitely compliant."

---

# **11\. Feature 6 — Document Expiry Monitoring**

The platform should identify documents that may become problematic.

Example:

> 🔴 **NUPRC Certificate expires before tender submission**

or:

> 🟠 **Insurance certificate expires during the proposed contract period**

The company should also have a **Document Expiry Dashboard**.

Example:

| Document | Expiry | Status |
| ----- | ----- | ----- |
| ISO 9001 | 12 Oct 2026 | Valid |
| Insurance | 25 Sept 2026 | Expiring soon |
| Tax Clearance | 30 Nov 2026 | Valid |

---

# **12\. Feature 7 — Assignment & Collaboration**

Once the matrix is generated, the Bid Manager assigns requirements.

Each person gets their own task view.

### **Example**

**Oluchi — 8 requirements**

* Insurance — Pending  
* Parent Company Guarantee — In Progress  
* Community Engagement Plan — Received  
* Contractor Brief Form — Pending

Users should be able to:

* upload documents  
* add comments  
* respond to questions  
* mark items complete  
* flag issues  
* request clarification  
* see deadlines

---

# **13\. Feature 8 — Automated Follow-Up**

The platform should reduce the amount of chasing done by the Bid Manager.

For example:

> **Reminder:**  
> &nbsp;You have 3 outstanding tender requirements due tomorrow.

And to the Bid Manager:

> **Oluchi has 2 overdue requirements.**

This turns the platform into a **bid coordination tool**, not merely a document-analysis tool.

---

# **14\. Feature 9 — Intelligent QC**

This should be one of the platform's major differentiators.

When a user uploads evidence, the platform checks it against the actual tender requirement.

### **QC dimensions**

Depending on the requirement, it can check:

* Correct document type  
* Correct company/entity  
* Correct dates  
* Required years  
* Completeness  
* Required signatures  
* Required stamps  
* Required forms  
* Required information  
* Required supporting evidence  
* Tender-specific template  
* Obvious inconsistencies  
* Expiry  
* Missing pages  
* Incorrect versions

---

# **15\. QC Result**

Every requirement receives a clear status.

### **🟢 Appears compliant**

The document appears to satisfy the requirement.

### **🟡 Review required**

The platform found something uncertain.

### **🔴 Potential non-compliance**

A likely issue was detected.

### **⚪ Not reviewed**

No QC has been performed yet.

---

## **Example**

**Requirement**

> Provide 3 years Audited Accounts: 2022, 2023 and 2024\.

**Uploaded document:** Audited Accounts.pdf

### **QC**

🟢 Document appears to be an audited financial statement.

🟢 Company name appears to match.

🟢 2022 accounts found.

🟢 2023 accounts found.

🔴 **2024 accounts not found.**

### **Result**

> **Potential Non-Compliance**

**Action:** Review and provide missing 2024 accounts.

This is much more valuable than simply showing:

> ✓ Document uploaded.

---

# **16\. Feature 10 — Tender-Specific Compliance Rules**

The platform should recognize instructions such as:

> "No changes to COMPANY wording/format are allowed."

and flag changes to client-provided templates.

The Chevron example explicitly states that changing the company's wording/format can result in disqualification.

Similarly, the platform should recognize requirements such as:

> "Failure to quote for ALL items ... shall lead to disqualification."

and turn that into a **critical compliance check** rather than an ordinary checklist item.

---

# **17\. Feature 11 — Compliance Risk Engine**

Not every requirement has the same importance.

The platform should identify:

### **Critical**

Potentially causes bid rejection/disqualification.

### **Mandatory**

Must be submitted.

### **Conditional**

Only applicable under certain circumstances.

### **Supporting**

Useful supporting information but not necessarily a bid-killer.

### **Informational**

Information required but with lower apparent submission risk.

The system should explain **why** something is considered high risk rather than simply assigning a mysterious score.

---

# **18\. Feature 12 — Submission Readiness Dashboard**

At any point, the Bid Manager should be able to see:

> ## **Tender Readiness**

> **Overall:** 84%

> 🟢 Completed: 72  
> &nbsp;🟡 Review required: 8  
> &nbsp;🔴 Potential issues: 4  
> &nbsp;⚪ Outstanding: 11

> **Critical outstanding items:** 3

> **Submission:** 20 July 2026

The percentage should be accompanied by the actual underlying items so that it doesn't create false confidence.

---

# **19\. Feature 13 — Final Bid QC**

Before submission, the platform should run a **Final Compliance Review**.

It should ask:

### **Requirements**

* Has every mandatory requirement been addressed?  
* Are any requirements still outstanding?  
* Are conditional requirements properly resolved?

### **Documents**

* Are required documents present?  
* Are the correct versions being used?  
* Are expired documents being submitted?

### **Content**

* Does the supplied evidence correspond to the requirement?  
* Are required dates/years covered?

### **Forms**

* Are required forms completed?  
* Are signatures present?  
* Are client templates preserved?

### **Commercial**

* Are all required pricing items addressed?  
* Are mandatory commercial templates included?

### **Nigerian Content**

* Are required NCDMB/NOGIC/Nigerian Content documents present?

### **HSE**

* Are required HSE policies, records and plans included?

---

# **20\. Feature 14 — Bid Compilation**

Once requirements have been completed, the platform should help organize the final submission.

The system should understand that different clients may have different structures.

For example:

> Technical  
> &nbsp;→ Part A  
> &nbsp;→ Part B  
> &nbsp;→ Part C  
> &nbsp;→ Nigerian Content  
> &nbsp;→ Financial  
> &nbsp;→ HSE  
> &nbsp;→ Experience  
> &nbsp;→ Equipment & Personnel  
> &nbsp;→ Commercial

The platform should help ensure documents are placed under the **correct tender section**.

---

# **21\. Feature 15 — Tender Templates**

Users should be able to create company-specific templates.

For example:

**Company Responsibility Matrix Template**

Default columns:

* Section  
* Requirement  
* Evidence/Deliverable  
* Responsible Party  
* Due Date  
* Status  
* QC  
* Remarks

A company could modify these to fit its own workflow.

This is important because your own matrix contains organizational practices that aren't necessarily part of the client's tender document—for example, assigning requirements to named employees and coordinating files through SharePoint.

---

# **22\. Feature 16 — Tender History**

Every completed tender should become part of the company's institutional knowledge.

Users should be able to see:

> **Previous Chevron Tender**

> What requirements were requested?

> Who handled them?

> Which company documents were used?

> What issues were encountered?

> Which requirements were difficult?

> What was ultimately submitted?

This creates a valuable historical knowledge base.

---

# **23\. Feature 17 — Reuse From Previous Bids**

When a new tender arrives:

> "This requirement is similar to a requirement from 4 previous tenders."

The platform can show:

* Previous response  
* Previously used documents  
* Previous owner  
* Previous evidence  
* Previous QC issues

This could significantly reduce repetitive bid preparation.

---

# **24\. Feature 18 — Management Dashboard**

Management doesn't need to see every requirement.

They need:

* Active tenders  
* Submission dates  
* Bid status  
* Major outstanding items  
* Critical compliance issues  
* Responsible bid manager  
* Overall readiness

Example:

| Tender | Client | Deadline | Readiness | Critical Issues |
| ----- | ----- | ----- | ----- | ----- |
| Tender A | Chevron | 20 Jul | 84% | 3 |
| Tender B | Shell | 28 Jul | 61% | 7 |
| Tender C | NNPC | 4 Aug | 93% | 1 |

---

# **25\. MVP**

The first version should **not attempt to build everything**.

The strongest MVP would focus on the workflow you personally experience every time a tender arrives.

### **MVP Feature Set**

**1\. Tender Upload**

↓

**2\. AI Tender Overview**

↓

**3\. AI Requirement Extraction**

↓

**4\. Responsibility Matrix**

↓

**5\. Parent Requirement \+ Sub-items**

↓

**6\. AI Suggested Responsibility**

↓

**7\. Document Upload/Collection**

↓

**8\. Company Document Library**

↓

**9\. AI Document Matching**

↓

**10\. Requirement-Level QC**

↓

**11\. Submission Readiness Dashboard**

↓

**12\. Final Compliance Checklist**

That is already a substantial product.

---

# **26\. What Should NOT Be MVP**

These are valuable later but shouldn't distract from the core problem:

* complex commercial pricing management  
* full CRM  
* procurement management  
* contract management  
* invoicing  
* project execution management  
* sophisticated analytics  
* extensive external integrations  
* broad multi-industry support

The initial product should become **exceptionally good at tender preparation and compliance**.

---

# **27\. Differentiating Product Idea**

The most interesting aspect of the product isn't:

> **"AI reads tenders."**

Many products can eventually do that.

The stronger proposition is:

> **"AI turns a tender into an executable responsibility and compliance workflow."**

And then:

> **"AI checks whether the evidence you've collected actually satisfies what the client asked for."**

That creates a continuous chain:

**Understand → Assign → Collect → Match → QC → Resolve → Submit**

---

# **28\. Example End-to-End Workflow**

### **9:00 AM**

Bid Manager uploads:

> `Chevron_Cementing_ITT.pdf`

### **9:02 AM**

Platform produces:

**Tender Overview**

* Client: Chevron  
* Project: Provision of Cementing Products and Services  
* Submission: 20 July  
* Technical requirements: 47  
* Nigerian Content: 18  
* HSE: 7  
* Financial: 5  
* Commercial: 6

### **9:05 AM**

Platform creates:

**83 requirements**

and identifies **126 individual deliverables/evidence items**.

### **9:10 AM**

Platform suggests owners.

Bid Manager reviews and confirms assignments.

### **9:15 AM**

Platform searches the company library.

It finds:

* NUPRC certificate  
* ISO certificates  
* company profile  
* HSE policies  
* previous project evidence

### **9:20 AM**

Team members receive their requirements.

### **11:00 AM**

Documents begin coming in.

The platform automatically performs QC.

### **2:00 PM**

The Bid Manager sees:

> 🔴 5 potential compliance issues  
> &nbsp;🟡 9 items require review  
> &nbsp;⚪ 12 outstanding items

### **Next day**

The Bid Manager resolves the issues.

### **Before submission**

Platform produces:

> **FINAL BID REVIEW**

> Mandatory requirements: 100% addressed  
> &nbsp;Potential compliance issues: 0 unresolved  
> &nbsp;Missing documents: 0  
> &nbsp;Documents requiring review: 2  
> &nbsp;Conditional requirements: resolved

> **Ready for final human review**

The final decision still belongs to the bid team.

---

# **29\. Product Philosophy**

There should be one principle behind the entire platform:

> **The AI should reduce the Bid Manager's workload without taking away the Bid Manager's control.**

Therefore:

**AI extracts → human verifies**

**AI suggests → human assigns**

**AI matches → human approves**

**AI detects → human resolves**

**AI checks → human makes the final submission decision**

This is particularly important for tendering because a seemingly small misunderstanding of a requirement can have serious consequences.

---

# **30\. Long-Term Vision**

Once the core workflow works, the product could evolve from a **Tender Assistant** into a company's **Tender Intelligence Platform**.

Eventually it could answer questions like:

> "Have we submitted this type of requirement before?"

> "Which documents do we repeatedly need?"

> "Which company documents are approaching expiry?"

> "Which departments consistently have outstanding bid requirements?"

> "Which tender requirements have caused compliance issues in previous bids?"

> "Show all tenders requiring NUPRC registration."

> "Find previous responses to similar technical requirements."

> "Prepare the responsibility matrix for this new tender using our company's previous assignment patterns."

At that point, the platform isn't simply reading documents. It becomes a **company's institutional memory for tendering**.

### **The core product in one sentence**

> **An AI-powered tender management platform that converts complex oil & gas tender documents into an intelligent responsibility matrix, coordinates evidence collection, reuses company documents, and performs requirement-level compliance QC before submission.**

This is a solid foundation for the product. The next useful artifact would be a **feature-priority/MVP roadmap** showing what belongs in Version 1, Version 2, and later—without getting into technical implementation.

&nbsp;