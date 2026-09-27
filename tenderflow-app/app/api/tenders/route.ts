import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { extractOverview } from "../../../lib/overview";
import { parsePdf } from "../../../lib/pdf";
import { buildRecord, listTenders, saveTender, uploadsDir, validateUpload } from "../../../lib/tenders";

export const runtime = "nodejs";
export const maxDuration = 120;

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  const { tenders, backend } = await listTenders();
  return NextResponse.json({ backend, tenders: tenders.map(({ pages, ...rest }) => rest) });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data with a 'file' field." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  const problem = validateUpload(file.name, file.size);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parsePdf(bytes);
  } catch (e) {
    console.error("TF-PARSE-ERROR:", e instanceof Error ? e.stack ?? e.message : String(e));
    return NextResponse.json({ error: "Could not read this PDF. Scanned/image-only PDFs are flagged after upload; unreadable files are rejected." }, { status: 422 });
  }

  const id = newId();
  const dir = path.join(uploadsDir(), id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "original.pdf"), bytes);

  const overview = extractOverview(parsed, file.name);
  const record = buildRecord(id, file.name, file.size, overview, parsed.page_count, parsed.scanned);
  const used = await saveTender(record, parsed.pages);

  return NextResponse.json(
    { backend: used, tender: { ...record, overview }, scanned: parsed.scanned },
    { status: 201 }
  );
}
