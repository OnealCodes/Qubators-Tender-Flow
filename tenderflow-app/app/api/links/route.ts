import { NextResponse } from "next/server";
import { logActivity } from "../../../lib/collab";
import { decideLink } from "../../../lib/library";

export const runtime = "nodejs";

// Body: { deliverable_id, library_doc_id, accept, tender_id? }.
// Accepting never marks QC — it only records the human's choice.
export async function POST(req: Request) {
  let body: { deliverable_id?: string; library_doc_id?: string; accept?: boolean; tender_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (!body.deliverable_id || !body.library_doc_id || typeof body.accept !== "boolean") {
    return NextResponse.json({ error: "deliverable_id, library_doc_id and accept are required." }, { status: 400 });
  }
  const link = await decideLink(body.deliverable_id, body.library_doc_id, body.accept);
  if (!link) return NextResponse.json({ error: "No proposed match found." }, { status: 404 });
  if (body.tender_id) {
    await logActivity(body.tender_id, body.accept ? "match_accept" : "match_reject", {
      deliverable_id: body.deliverable_id,
      library_doc_id: body.library_doc_id,
    });
  }
  return NextResponse.json({ link });
}
