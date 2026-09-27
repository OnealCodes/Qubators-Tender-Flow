import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { addEvidence, logActivity } from "../../../../../lib/collab";
import { uploadsDir } from "../../../../../lib/tenders";

export const runtime = "nodejs";
export const maxDuration = 120;

const EVIDENCE_TYPES = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".zip"];

function evidenceProblem(fileName: string, size: number): string | null {
  const ext = path.extname(fileName).toLowerCase();
  if (!EVIDENCE_TYPES.includes(ext)) return `Evidence must be one of: ${EVIDENCE_TYPES.join(", ")}.`;
  if (size <= 0) return "Empty file.";
  if (size > 200 * 1024 * 1024) return "File exceeds the 200 MB limit.";
  return null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data with a 'file' field." }, { status: 400 });
  }
  const file = form.get("file");
  const tenderId = (form.get("tender_id") as string) || "";
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  if (!tenderId) return NextResponse.json({ error: "tender_id is required." }, { status: 400 });
  const problem = evidenceProblem(file.name, file.size);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = path.join(uploadsDir(), tenderId, "evidence", id);
  await fs.mkdir(dir, { recursive: true });
  const safe = `${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
  const storagePath = path.join(dir, safe);
  await fs.writeFile(storagePath, bytes);

  const entry = await addEvidence(id, file.name, file.size, storagePath);
  await logActivity(tenderId, "evidence", { deliverable_id: id, file_name: file.name, evidence_id: entry.id });
  return NextResponse.json({ evidence: entry }, { status: 201 });
}
