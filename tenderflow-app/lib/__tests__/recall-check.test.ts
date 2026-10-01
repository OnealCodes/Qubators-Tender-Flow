// Recall check - maps saved rows to chunks and reports bidChunkIds status
import { describe, it, expect } from "vitest";
import { chunkBySection, buildDocumentMap, bidChunkIds } from "../chunks";
import fs from "node:fs";

function loadPages(tid: string) {
  const raw = fs.readFileSync(`uploads/${tid}/pages.json`, "utf8");
  return JSON.parse(raw);
}

const damasRows = [
  { ref: null, section: "Commercial", page: 4, title: "Evidence of NUPRC registration for appropriate service." },
  { ref: null, section: "HSE", page: 4, title: "Provide evidence of written HSE Polices duly signed and dated by the CEO (HSE Policy Statement;" },
  { ref: null, section: "HSE", page: 4, title: "Attach a copy of your company's HSE manual." },
  { ref: null, section: "Technical", page: 4, title: "Organizational structure of your company including CV of relevant personnel." },
  { ref: null, section: "Technical", page: 4, title: "Details of principal items of equipment, pictures of corporate facility, offices, warehouses, workshop etc." },
  { ref: null, section: "Commercial", page: 4, title: "Evidence of company registration to practice in Nigeria." },
  { ref: null, section: "Commercial", page: 4, title: "Evidence of similar jobs successfully done in the past five years with verifiable evidence of completion certificates." },
  { ref: null, section: "Financial", page: 4, title: "Audited account report (last three (3) years i.e. 2023 - 2025)." },
  { ref: null, section: "Technical", page: 4, title: "Cost of all products, equipment, accessories and services required for well design and drillability studies." },
  { ref: null, section: "Commercial", page: 4, title: "A work execution plan." },
  { ref: null, section: "Financial", page: 4, title: "Tax clearance certificate (last three (3) years i.e. 2023 - 2025)." },
];

const conductorRows = [
  { ref: null, section: "Technical", page: 4, title: "The Contractor shall therefore establish an approved design basis, verify strength, dynamic response, Vortex-Induced Vib" },
  { ref: "1.3", section: "Technical", page: 4, title: "Project Scope The project requires the complete structural engineering analysis of the free-standing conductor across ev" },
  { ref: "1.5", section: "Technical", page: 5, title: "Abbreviations API American Petroleum Institute CP Cathodic Protection CPT / CPTu Cone Penetration Test / with pore press" },
  { ref: "1.6.2", section: "Technical", page: 6, title: "Amd 1:2025) Site-specific assessment of mobile offshore units API RP 2SIM Structural integrity management of fixed offsh" },
  { ref: "1.7", section: "Technical", page: 6, title: "Contractor has the overall responsibility to ensure that all work is performed in accordance with this Scope of Work, ap" },
  { ref: "1.6.2", section: "General", page: 6, title: "[VERIFY gazetted version in force at issue] NUPRC guidelines and approvals Well suspension application and extension;" },
  { ref: "2.3.1", section: "Nigerian Content", page: 8, title: "The Nigerian Upstream Petroleum Decommissioning and Abandonment Regulations 2026, which replaced the 2023 Regulations, p" },
  { ref: "2.2", section: "Commercial", page: 8, title: "They are stated here rather than left implicit in the work sections because tenderers shall price them deliberately." },
  { ref: "2.1", section: "Technical", page: 8, title: "Contractor shall attend a project initiation meeting with the appointed Edi E&P representative(s) before performing its" },
  { ref: "2.3.5", section: "Technical", page: 9, title: "After the drilling unit demobilises, changing any of these parameters requires a rig return with significant cost and sc" },
  { ref: "2.3.1", section: "Technical", page: 9, title: "The engineering judgement behind this position is that the marginal cost of additional wall thickness and anode mass at" },
  { ref: "2.3.1", section: "Technical", page: 9, title: "Adopt a nominal structural design life of 10 years, covering the full credible suspension period including any extension" },
  { ref: "2.4.1", section: "Technical", page: 10, title: "A change to conductor setting depth is a change to the well programme: it affects the drilling schedule, the conductor p" },
  { ref: "2.9", section: "Technical", page: 12, title: "Assessment at the extreme current alone is not acceptable and will be rejected at review." },
  { ref: "2.10", section: "Technical", page: 13, title: "The weld classification shall reflect a field girth weld made offshore under driving-schedule conditions (single-sided," },
  { ref: "2.18.2", section: "Commercial", page: 15, title: "Bidders shall price against the stated tender assumption and shall not substitute their own." },
  { ref: "2.20", section: "Technical", page: 17, title: "Schedule Binding constraint: all analysis and deliverable D-16 shall be complete and Company-approved before conductor p" },
  { ref: "2.20", section: "Technical", page: 17, title: "Analysis shall not start before this 4 Environmental and geotechnical interpretation issued (D-03, D-04) 7 In-place stre" },
  { ref: "2.22", section: "Technical", page: 17, title: "This quality assurance system, with its quality control procedures, personnel and tools, shall comply with ISO 9001:" },
  { ref: "2.22", section: "Commercial", page: 17, title: "A preliminary quality plan, which can be revised to contract quality plan status on award of contract." },
  { ref: "2.23", section: "Commercial", page: 18, title: "Bidders shall state whether they propose to provide this within their own organisation or via a nominated third party, a" },
  { ref: "3.3", section: "Technical", page: 19, title: "The expected time by which the work is scheduled to start and to be completed." },
  { ref: "4.1", section: "Nigerian Content", page: 20, title: "ISO 9001:2015 certificate and preliminary quality plan per Section 2.22." },
  { ref: "4.1", section: "Nigerian Content", page: 20, title: "Nigerian Content Plan and NCDMB compliance evidence." },
  { ref: "4.1", section: "Technical", page: 20, title: "Schedule with critical path, meeting the Section 2.20 constraint." },
  { ref: "4.1", section: "Technical", page: 20, title: "Reference projects: free-standing conductors, unbraced caissons, or VIV-governed slender structures." },
  { ref: "4.1", section: "Technical", page: 20, title: "Deviation register." },
  { ref: "4.1", section: "Technical", page: 20, title: "CVs of the named lead analyst, checker and any third-party verifier." },
  { ref: "4.1", section: "Technical", page: 20, title: "Priced schedule per Section 4.2." },
  { ref: "4.1", section: "Technical", page: 20, title: "Method statement per Section 2.21, covering each section of the scope." },
  { ref: "4.1", section: "Technical", page: 20, title: "Software proposed for each analysis type, with version and licence status." },
  { ref: "4.2", section: "Technical", page: 20, title: "Item Scope Price basis Group A Sections 2.4 to 2.8: design basis, environmental, geotechnical, strength, dynamics Lump s" },
];

function mapRowToChunk(row: { ref: string | null; section: string; page: number; title: string }, chunks: { startPage: number; endPage: number; id: string }[]): string {
  const c = chunks.find(c => c.startPage <= row.page && row.page <= c.endPage);
  return c?.id || "NO-CHUNK";
}

function printReport(name: string, tid: string, rows: { ref: string | null; section: string; page: number; title: string }[]) {
  const pages = loadPages(tid);
  const chunks = chunkBySection(pages);
  const map = buildDocumentMap(pages, chunks);
  const bidIds = new Set(bidChunkIds(map));
  
  console.log(`\n===== ${name} (${tid}) =====`);
  console.log(`Total chunks: ${chunks.length}, bidChunkIds: ${bidIds.size} (${[...bidIds].join(",")})`);
  
  for (const c of chunks) {
    const inBid = bidIds.has(c.id) ? "-> GEMINI" : "  kept local";
    const flagged = map.zones.find(z => z.chunkId === c.id)?.hasBidClause ? " FLAGGED" : "";
    console.log(`  ${c.id} [${c.source}] ref=${c.ref ?? "null"} p.${c.startPage}-${c.endPage} zone=${map.zones.find(z=>z.chunkId===c.id)?.zone} ${inBid}${flagged} | ${c.title.slice(0,80)}`);
  }
  
  console.log(`\n--- ROW MAPPING ---`);
  for (const row of rows) {
    const chunkId = mapRowToChunk(row, chunks);
    const inBid = bidIds.has(chunkId) ? "-> GEMINI" : "  kept local";
    const flagged = map.zones.find(z => z.chunkId === chunkId)?.hasBidClause ? " FLAGGED" : "";
    console.log(`  ${row.ref ?? "null"} p.${row.page} ${inBid}${flagged} | ${row.title.slice(0,100)}`);
  }
  
  console.log(`\n--- SAVED ROWS NOT IN bidChunkIds (would be LOST if only bidChunkIds sent) ---`);
  const lost = rows.filter(r => !bidIds.has(mapRowToChunk(r, chunks)));
  for (const row of lost) {
    console.log(`  ${row.ref ?? "null"} p.${row.page} | ${row.title.slice(0,100)}`);
  }
  console.log(`  Total: ${lost.length} of ${rows.length} rows`);
  
  return { lostCount: lost.length, totalRows: rows.length };
}

describe("Recall check - mapping saved rows to chunks", () => {
  it("reports DAMAS row-to-chunk mapping and losses", () => {
    const { lostCount, totalRows } = printReport("DAMAS", "muo3ho8t-8prm6p", damasRows);
    console.log(`\nDAMAS RECALL: ${totalRows - lostCount}/${totalRows} rows would reach Gemini`);
    expect(lostCount).toBeLessThanOrEqual(totalRows);
  });

  it("reports CONDUCTOR row-to-chunk mapping and losses", () => {
    const { lostCount, totalRows } = printReport("CONDUCTOR", "mulb0dka-1zv4b0", conductorRows);
    console.log(`\nCONDUCTOR RECALL: ${totalRows - lostCount}/${totalRows} rows would reach Gemini`);
    expect(lostCount).toBeLessThanOrEqual(totalRows);
  });
});