// TenderFlow map-report — prints chunk, zone, global-rule and submission-clause
// report for a tender using its saved pages.json only. No DB call, no AI.
//
// Usage:
//   node --experimental-strip-types scripts/map-report.mjs <tender-id>
//   node --experimental-strip-types scripts/map-report.mjs muo3ho8t-8prm6p
//
// The script reads uploads/<tender-id>/pages.json which is on disk (git-ignored).

import fs from "node:fs";
import { chunkBySection, buildDocumentMap, bidChunkPlan } from "../lib/chunks.ts";

const tid = process.argv[2];
if (!tid) {
  console.error("Usage: node --experimental-strip-types scripts/map-report.mjs <tender-id>");
  process.exit(1);
}

const pagesPath = `uploads/${tid}/pages.json`;
if (!fs.existsSync(pagesPath)) {
  console.error(`Not found: ${pagesPath}`);
  console.error("Available tender IDs:");
  const dirs = fs.readdirSync("uploads").filter((d) => {
    try { return fs.statSync(`uploads/${d}`).isDirectory(); } catch { return false; }
  });
  dirs.forEach((d) => console.error(`  ${d}`));
  process.exit(1);
}

const pages = JSON.parse(fs.readFileSync(pagesPath, "utf8"));
const chunks = chunkBySection(pages);
const map = buildDocumentMap(pages, chunks);
const plan = bidChunkPlan(map);
const fullSet = new Set(plan.fullChunks);
const flaggedSet = new Set(plan.flaggedChunks);

console.log(`\n${"=".repeat(70)}`);
console.log(`MAP REPORT — tender: ${tid}`);
console.log(`${"=".repeat(70)}`);
console.log(`Pages: ${map.pageCount}  Chunks: ${map.chunkCount}`);
console.log(
  `Gemini plan: ${plan.fullChunks.length} full + ` +
  `${plan.flaggedChunks.length} flagged-passage = ${plan.allChunkIds.length} total`
);

console.log(`\n${"─".repeat(70)}`);
console.log("CHUNKS");
console.log(`${"─".repeat(70)}`);
for (const c of chunks) {
  const zone = map.zones.find((z) => z.chunkId === c.id);
  let sendMode = "  [kept local]           ";
  if (fullSet.has(c.id)) sendMode = "→ [GEMINI FULL]         ";
  else if (flaggedSet.has(c.id)) sendMode = "→ [GEMINI FLAGGED PASS] ";
  const flagNote = zone?.hasBidClause ? " ★bid-clause" : "";
  console.log(
    `  ${c.id.padEnd(4)} [${c.source.padEnd(8)}] p.${String(c.startPage).padStart(3)}-${String(c.endPage).padEnd(3)}` +
    `  zone=${String(zone?.zone ?? "?").padEnd(16)} ${sendMode}${flagNote}` +
    `\n       ref=${c.ref ?? "null"}  "${c.title.slice(0, 80)}"`
  );
}

console.log(`\n${"─".repeat(70)}`);
console.log("GLOBAL RULES");
console.log(`${"─".repeat(70)}`);
if (map.globalRules.length === 0) {
  console.log("  (none)");
} else {
  for (const r of map.globalRules) {
    console.log(`  p.${String(r.page).padStart(3)}  [${r.rule.padEnd(20)}]  "${r.text.slice(0, 100)}"`);
  }
}

console.log(`\n${"─".repeat(70)}`);
console.log("SUBMISSION CLAUSES (bidder-addressed passages in contract-scope/appendix)");
console.log(`${"─".repeat(70)}`);
if (map.submissionClauses.length === 0) {
  console.log("  (none)");
} else {
  for (const s of map.submissionClauses) {
    console.log(`  chunk=${s.chunkId}  p.${String(s.page).padStart(3)}  "${s.text.slice(0, 120)}"`);
  }
}

console.log(`\n${"─".repeat(70)}`);
console.log("OUTLINE");
console.log(`${"─".repeat(70)}`);
for (const o of map.outline) {
  const sendMode = fullSet.has(o.chunkId)
    ? "→ GEMINI FULL   "
    : flaggedSet.has(o.chunkId)
    ? "→ GEMINI FLAGGED"
    : "  kept local    ";
  console.log(
    `  ${sendMode}  p.${String(o.page).padStart(3)}` +
    `  ref=${String(o.ref ?? "null").padEnd(8)}` +
    `  "${o.title.slice(0, 80)}"`
  );
}

console.log(`\n${"─".repeat(70)}`);
console.log("GEMINI SEND PLAN");
console.log(`${"─".repeat(70)}`);
console.log("Full chunks (bid-instructions / forms / commercial) — sent in full:");
if (plan.fullChunks.length === 0) {
  console.log("  (none)");
} else {
  plan.fullChunks.forEach((id) => {
    const c = chunks.find((x) => x.id === id);
    console.log(`  ${id}  p.${c?.startPage}-${c?.endPage}  "${c?.title.slice(0, 80)}"`);
  });
}
console.log("\nFlagged-passage chunks (contract-scope/appendix with bidder clauses) — flagged passages + context only:");
if (plan.flaggedChunks.length === 0) {
  console.log("  (none)");
} else {
  plan.flaggedChunks.forEach((id) => {
    const c = chunks.find((x) => x.id === id);
    const sc = map.submissionClauses.filter((s) => s.chunkId === id);
    console.log(`  ${id}  p.${c?.startPage}-${c?.endPage}  "${c?.title.slice(0, 80)}"`);
    sc.forEach((s) => console.log(`    clause p.${s.page}: "${s.text.slice(0, 100)}"`));
  });
}
console.log(`\n${"=".repeat(70)}\n`);
