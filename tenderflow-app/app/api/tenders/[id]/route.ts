import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { logActivity } from "../../../../lib/collab";
import { getTender, postgresReachable, uploadsDir } from "../../../../lib/tenders";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { tender, backend } = await getTender(id);
  if (!tender) {
    return NextResponse.json({ error: "Tender not found." }, { status: 404 });
  }
  return NextResponse.json({ backend, tender });
}

const STATUSES = ["intake", "active", "submitted", "archived"];

// Lifecycle: intake → active → submitted → archived. Logged, reversible.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (!body.status || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of: ${STATUSES.join(", ")}.` }, { status: 400 });
  }
  const { tender } = await getTender(id);
  if (!tender) return NextResponse.json({ error: "Tender not found." }, { status: 404 });

  if (await postgresReachable()) {
    try {
      const { Pool } = await import("pg");
      const p = new Pool({ connectionString: process.env.DATABASE_URL });
      try {
        await p.query("UPDATE tenders SET status=$1 WHERE id=$2", [body.status, id]);
      } finally {
        await p.end();
      }
    } catch { /* fall through to local */ }
  }
  try {
    const file = path.join(uploadsDir(), "db.json");
    const raw = await fs.readFile(file, "utf8");
    const doc = JSON.parse(raw);
    let touched = false;
    for (const t of doc.tenders ?? []) {
      if (t.id === id) {
        t.status = body.status;
        touched = true;
      }
    }
    if (touched) await fs.writeFile(file, JSON.stringify(doc, null, 2), "utf8");
  } catch { /* no local mirror */ }

  await logActivity(id, "status_change", { from: tender.status, to: body.status });
  return NextResponse.json({ id, status: body.status });
}

// Permanent delete: database rows (FK cascades verified) + files on disk +
// local mirrors. Archive first if unsure — this cannot be undone.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { tender } = await getTender(id);
  if (!tender) return NextResponse.json({ error: "Tender not found." }, { status: 404 });

  // 1. Files on disk.
  try {
    await fs.rm(path.join(uploadsDir(), id), { recursive: true, force: true });
  } catch { /* already gone */ }

  // 2. Local JSON mirrors.
  try {
    const dbFile = path.join(uploadsDir(), "db.json");
    const db = JSON.parse(await fs.readFile(dbFile, "utf8"));
    db.tenders = (db.tenders ?? []).filter((t: { id: string }) => t.id !== id);
    await fs.writeFile(dbFile, JSON.stringify(db, null, 2), "utf8");
  } catch { /* ignore */ }
  try {
    const reqFile = path.join(uploadsDir(), "requirements.json");
    const rdoc = JSON.parse(await fs.readFile(reqFile, "utf8"));
    const reqIds = new Set((rdoc.requirements ?? []).filter((r: { tender_id: string }) => r.tender_id === id).map((r: { id: string }) => r.id));
    rdoc.requirements = (rdoc.requirements ?? []).filter((r: { tender_id: string }) => r.tender_id !== id);
    rdoc.deliverables = (rdoc.deliverables ?? []).filter((d: { requirement_id: string }) => !reqIds.has(d.requirement_id));
    rdoc.runs = (rdoc.runs ?? []).filter((r: { tender_id: string }) => r.tender_id !== id);
    await fs.writeFile(reqFile, JSON.stringify(rdoc, null, 2), "utf8");
    // Deliverable-scoped mirrors.
    const dropDelivs = async (file: string, key: string) => {
      try {
        const f = path.join(uploadsDir(), file);
        const doc = JSON.parse(await fs.readFile(f, "utf8"));
        if (Array.isArray(doc[key])) {
          doc[key] = doc[key].filter((x: { deliverable_id: string }) => !reqIds.has(x.deliverable_id));
          await fs.writeFile(f, JSON.stringify(doc, null, 2), "utf8");
        }
      } catch { /* ignore */ }
    };
    await dropDelivs("collab.json", "evidence");
    await dropDelivs("collab.json", "comments");
    await dropDelivs("library.json", "links");
    await dropDelivs("qc.json", "results");
    try {
      const f = path.join(uploadsDir(), "collab.json");
      const doc = JSON.parse(await fs.readFile(f, "utf8"));
      doc.activities = (doc.activities ?? []).filter((a: { tender_id: string }) => a.tender_id !== id);
      await fs.writeFile(f, JSON.stringify(doc, null, 2), "utf8");
    } catch { /* ignore */ }
    try {
      const f = path.join(uploadsDir(), "ai.json");
      const doc = JSON.parse(await fs.readFile(f, "utf8"));
      doc.assessments = (doc.assessments ?? []).filter((a: { tender_id: string }) => a.tender_id !== id);
      await fs.writeFile(f, JSON.stringify(doc, null, 2), "utf8");
    } catch { /* ignore */ }
  } catch { /* ignore */ }

  // 3. Postgres (cascades verified: pages, requirements→deliverables→
  // evidence/comments/links/qc, runs, activities, ai_assessments).
  if (await postgresReachable()) {
    try {
      const { Pool } = await import("pg");
      const p = new Pool({ connectionString: process.env.DATABASE_URL });
      try {
        await p.query("DELETE FROM tenders WHERE id=$1", [id]);
      } finally {
        await p.end();
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Database delete failed." }, { status: 500 });
    }
  }
  return NextResponse.json({ deleted: true });
}
