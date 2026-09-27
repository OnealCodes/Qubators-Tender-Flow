import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { addDoc, listDocs } from "../../../lib/library";
import { uploadsDir } from "../../../lib/tenders";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const include = new URL(req.url).searchParams.get("history") === "1";
  return NextResponse.json({ docs: await listDocs(include) });
}

// Accepts multipart (file + metadata) or JSON (metadata only).
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";
  let input: Record<string, unknown> = {};
  let file: File | null = null;

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File && f.size > 0) file = f;
    for (const k of ["name", "doc_type", "version", "issue_date", "expiry_date", "dept", "entity"]) {
      const v = form.get(k);
      if (typeof v === "string" && v) input[k] = v;
    }
    if (!input.name && file) input.name = file.name.replace(/\.[A-Za-z0-9]+$/, "").replace(/[_-]+/g, " ");
  } else {
    try {
      input = await req.json();
    } catch {
      return NextResponse.json({ error: "Expected multipart or JSON body." }, { status: 400 });
    }
  }

  let storage_path: string | null = null;
  let file_size = 0;
  if (file) {
    if (file.size > 200 * 1024 * 1024) return NextResponse.json({ error: "File exceeds the 200 MB limit." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const dir = path.join(uploadsDir(), "library");
    await fs.mkdir(dir, { recursive: true });
    const safe = `${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]+/g, "_")}`;
    storage_path = path.join(dir, safe);
    await fs.writeFile(storage_path, bytes);
    file_size = file.size;
  }

  try {
    const { doc, deduped } = await addDoc({
      name: String(input.name ?? ""),
      doc_type: typeof input.doc_type === "string" ? input.doc_type : "general",
      version: typeof input.version === "string" ? input.version : undefined,
      issue_date: typeof input.issue_date === "string" ? input.issue_date : null,
      expiry_date: typeof input.expiry_date === "string" ? input.expiry_date : null,
      dept: typeof input.dept === "string" ? input.dept : null,
      entity: typeof input.entity === "string" ? input.entity : null,
      storage_path,
      file_size,
    });
    return NextResponse.json({ doc, deduped }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save document." }, { status: 400 });
  }
}
