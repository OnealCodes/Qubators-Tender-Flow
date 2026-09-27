import { NextResponse } from "next/server";
import { addComment, listComments, logActivity } from "../../../../../lib/collab";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ comments: await listComments(id) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { body?: string; kind?: string; tender_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const comment = await addComment(id, body.body ?? "", body.kind ?? "comment");
  if (!comment) return NextResponse.json({ error: "Body is required; kind must be comment, issue, or clarification_request." }, { status: 400 });
  if (body.tender_id) {
    await logActivity(body.tender_id, body.kind === "comment" ? "comment" : body.kind === "issue" ? "issue" : "clarification", { deliverable_id: id, comment_id: comment.id });
  }
  return NextResponse.json({ comment }, { status: 201 });
}
