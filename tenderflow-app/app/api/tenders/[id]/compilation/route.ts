import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { listEvidence } from "../../../../../lib/collab";
import { linksFor, listDocs } from "../../../../../lib/library";
import { getActive } from "../../../../../lib/requirements";
import { getTender, uploadsDir } from "../../../../../lib/tenders";

export const runtime = "nodejs";
export const maxDuration = 120;

// Client submission structure (PRD §20 example). Each deliverable is filed
// under its requirement section; evidence files are copied in.
const FOLDERS = [
  "Technical/Part A",
  "Technical/Part B",
  "Technical/Part C",
  "Nigerian Content",
  "Financial",
  "HSE",
  "Experience",
  "Equipment & Personnel",
  "Commercial",
];

function folderFor(section: string, title: string): string {
  const s = section.toLowerCase();
  const t = title.toLowerCase();
  if (s.includes("nigerian")) return "Nigerian Content";
  if (s.includes("financ")) return "Financial";
  if (s.includes("hse") || s.includes("safety")) return "HSE";
  if (s.includes("commercial") || s.includes("pricing") || /quot|price/.test(t)) return "Commercial";
  if (/experience|track record/.test(t)) return "Experience";
  if (/personnel|\bcv\b|organogram|equipment/.test(t)) return "Equipment & Personnel";
  return "Technical/Part A";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [{ requirements, deliverables }, docs, tenderRes] = await Promise.all([
    getActive(id),
    listDocs(),
    getTender(id),
  ]);
  if (!tenderRes.tender) return NextResponse.json({ error: "Tender not found." }, { status: 404 });
  const docById = new Map(docs.map((d) => [d.id, d]));
  const links = await linksFor(deliverables.map((d) => d.id));
  const acceptedByDeliv = new Map(
    links.filter((l) => l.status === "accepted").map((l) => [l.deliverable_id, docById.get(l.library_doc_id)])
  );

  const outDir = path.join(uploadsDir(), id, "compilation");
  await fs.mkdir(outDir, { recursive: true });
  const manifest: { folder: string; files: { name: string; from: string }[] }[] =
    FOLDERS.map((f) => ({ folder: f, files: [] }));

  for (const d of deliverables) {
    const req = requirements.find((r) => r.id === d.requirement_id);
    const folder = folderFor(req?.section ?? "", `${d.title} ${req?.title ?? ""}`);
    const slot = manifest.find((m) => m.folder === folder)!;
    const ev = await listEvidence(d.id);
    for (const f of ev) {
      const dest = path.join(outDir, folder, f.file_name.replace(/[^A-Za-z0-9._-]+/g, "_"));
      await fs.mkdir(path.dirname(dest), { recursive: true });
      try {
        await fs.copyFile(f.storage_path, dest);
        slot.files.push({ name: f.file_name, from: `evidence:${d.title}` });
      } catch { /* source missing on disk; listed as missing below */ }
    }
    const linked = acceptedByDeliv.get(d.id);
    if (linked) slot.files.push({ name: `${linked.name} [library ${linked.version}]`, from: `library:${d.title}` });
    if (!ev.length && !linked) slot.files.push({ name: `MISSING — ${d.title}`, from: "outstanding" });
  }

  const manifestText = `# Bid compilation — ${tenderRes.tender.title}\n\n` +
    manifest.map((m) => `## ${m.folder}\n${m.files.map((f) => `- ${f.name} (${f.from})`).join("\n") || "- (empty)"}`).join("\n\n");
  await fs.writeFile(path.join(outDir, "manifest.md"), manifestText, "utf8");

  return NextResponse.json({
    folders: manifest,
    missing: manifest.flatMap((m) => m.files.filter((f) => f.from === "outstanding").map((f) => `${m.folder} / ${f.name}`)),
  });
}
