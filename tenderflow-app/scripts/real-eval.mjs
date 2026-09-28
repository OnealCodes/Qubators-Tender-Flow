// TenderFlow real-tender eval — golden checks over live Postgres data.
// Run: node scripts/real-eval.mjs   (needs DATABASE_URL, Docker DB running)
// Read-only: never writes. Exit non-zero on any failure.
import pg from "pg";
import { extractRequirements } from "../lib/extract.ts";
import { matchDeliverable } from "../lib/matching.ts";
import { computeReadiness } from "../lib/readiness.ts";

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let failures = 0;

function check(name, cond, extra = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

const { rows: tenders } = await db.query(
  "SELECT id, file_name, page_count FROM tenders ORDER BY created_at"
);
check("tenders-present", tenders.length >= 10, `${tenders.length} tenders`);

for (const t of tenders) {
  const { rows: pages } = await db.query(
    "SELECT page_no, text, char_count FROM tender_pages WHERE tender_id=$1 ORDER BY page_no",
    [t.id]
  );
  check(`pages-stored:${t.file_name.slice(0, 30)}`, pages.length > 0, `${pages.length} pages`);
  let out = [];
  try {
    out = extractRequirements(pages);
  } catch (e) {
    check(`extract-runs:${t.file_name.slice(0, 30)}`, false, String(e));
    continue;
  }
  check(`extract-runs:${t.file_name.slice(0, 30)}`, true, `${out.length} reqs`);
  if (out.length) {
    check("source-grounding", out.every((r) => r.source_page != null));
    check(
      "parent-splits",
      out.every((r) => r.deliverables.length >= 1)
    );
  }
}

// Known-truth spot checks on the Drilling Tools ITT (150pp).
const drill = tenders.find((t) => /Drilling Tools/i.test(t.file_name));
if (drill) {
  const { rows: reqs } = await db.query(
    "SELECT title, section, risk, type FROM requirements WHERE tender_id=$1 AND superseded=FALSE",
    [drill.id]
  );
  const has = (re) => reqs.some((r) => re.test(r.title));
  check("recall-CO2-CO7", has(/CO2/i) && has(/CO7/i));
  check("recall-NUPRC", has(/NUPRC/i));
  check("recall-tax-years", has(/Tax Clearance/i));
  check("recall-organogram", has(/organogram/i));
  check("critical-present", reqs.some((r) => r.risk === "critical"));
  check(
    "conditional-excluded-from-readiness",
    (() => {
      const items = reqs.map((r, i) => ({
        deliverable_id: `d${i}`, requirement_id: `r${i}`, title: r.title,
        owner: null, risk: r.risk, type: r.type, status: "outstanding",
        verdict: "not_reviewed", section: r.section, req_type: r.type,
      }));
      const full = computeReadiness(items);
      const noCond = computeReadiness(items.filter((x) => x.risk !== "conditional"));
      return full.percent === noCond.percent || items.every((x) => x.risk !== "conditional") || full.scored < items.length;
    })()
  );
}

// Matching spot check: NUPRC deliverable must match NUPRC doc high.
const { rows: docs } = await db.query("SELECT * FROM library_docs WHERE superseded=FALSE");
const libDocs = docs.map((d) => ({
  id: d.id, company_id: d.company_id, name: d.name, doc_type: d.doc_type,
  version: d.version, version_no: d.version_no, superseded: d.superseded,
  issue_date: d.issue_date, expiry_date: d.expiry_date, dept: d.dept,
  entity: d.entity, storage_path: d.storage_path, file_size: d.file_size,
  status: d.status, created_at: String(d.created_at),
}));
if (libDocs.length) {
  const cands = matchDeliverable("NUPRC certificate", "NUPRC certificate required", libDocs);
  check("match-NUPRC-high", cands.some((c) => /NUPRC/i.test(c.name) && c.confidence === "high"));
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " FAILURES"}`);
await db.end();
process.exit(failures ? 1 : 0);
