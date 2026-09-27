"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";

interface Req {
  id: string;
  title: string;
  owner: string | null;
  suggested_owner: string | null;
  status: string;
}

interface Deliv {
  id: string;
  requirement_id: string;
  title: string;
  owner: string | null;
  status: string;
  due_date: string | null;
}

interface Evidence { id: string; file_name: string; file_size: number; created_at: string; }
interface CommentT { id: string; author: string; kind: string; body: string; created_at: string; }
interface Reminder { deliverable_id: string; title: string; owner: string; due_date: string; status: string; overdue: boolean; }

function toneFor(s: string) {
  if (/received|complete/i.test(s)) return "green";
  if (/progress|review/i.test(s)) return "amber";
  return "grey";
}

export default function AssignmentsPage() {
  const [tenders, setTenders] = useState<{ id: string; title: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [delivs, setDelivs] = useState<Deliv[]>([]);
  const [overdue, setOverdue] = useState<Reminder[]>([]);
  const [dueSoon, setDueSoon] = useState<Reminder[]>([]);
  const [overdueByOwner, setOverdueByOwner] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Record<string, Evidence[]>>({});
  const [comments, setComments] = useState<Record<string, CommentT[]>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [commentKind, setCommentKind] = useState<Record<string, string>>({});
  const [changeFor, setChangeFor] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const loadAll = useCallback(async (id: string) => {
    const [ex, rem] = await Promise.all([
      fetch(`/api/tenders/${id}/extract`).then((r) => r.json()),
      fetch(`/api/tenders/${id}/reminders`).then((r) => r.json()),
    ]);
    setReqs(ex.requirements ?? []);
    setDelivs(ex.deliverables ?? []);
    setOverdue(rem.overdue ?? []);
    setDueSoon(rem.dueSoon ?? []);
    setOverdueByOwner(rem.overdueByOwner ?? {});
  }, []);

  useEffect(() => {
    fetch("/api/tenders")
      .then((r) => r.json())
      .then((j) => {
        setTenders(j.tenders ?? []);
        if (j.tenders?.length) {
          setActiveId(j.tenders[0].id);
          loadAll(j.tenders[0].id);
        }
      })
      .catch(() => {});
  }, [loadAll]);

  async function openDeliv(id: string) {
    setOpen((cur) => (cur === id ? null : id));
    if (!evidence[id]) {
      const j = await fetch(`/api/deliverables/${id}`).then((r) => r.json());
      setEvidence((s) => ({ ...s, [id]: j.evidence ?? [] }));
      setComments((s) => ({ ...s, [id]: j.comments ?? [] }));
    }
  }

  async function patchDeliv(id: string, patch: Record<string, unknown>) {
    const r = await fetch(`/api/deliverables/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (r.ok && activeId) loadAll(activeId);
  }

  async function uploadEvidence(id: string, file: File) {
    if (!activeId) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tender_id", activeId);
    const r = await fetch(`/api/deliverables/${id}/evidence`, { method: "POST", body: fd });
    if (r.ok) {
      const j = await fetch(`/api/deliverables/${id}`).then((x) => x.json());
      setEvidence((s) => ({ ...s, [id]: j.evidence ?? [] }));
      loadAll(activeId);
    } else {
      const j = await r.json().catch(() => ({}));
      setNotice(j.error ?? "Evidence upload failed.");
    }
  }

  async function postComment(id: string) {
    if (!activeId || !(commentDraft[id] ?? "").trim()) return;
    const r = await fetch(`/api/deliverables/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentDraft[id], kind: commentKind[id] ?? "comment", tender_id: activeId }),
    });
    if (r.ok) {
      setCommentDraft((s) => ({ ...s, [id]: "" }));
      const j = await fetch(`/api/deliverables/${id}`).then((x) => x.json());
      setComments((s) => ({ ...s, [id]: j.comments ?? [] }));
    }
  }

  async function assign(reqId: string, owner: string) {
    if (!owner.trim()) return;
    const r = await fetch(`/api/requirements/${reqId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: owner.trim() }),
    });
    if (r.ok && activeId) {
      setChangeFor((s) => {
        const c = { ...s };
        delete c[reqId];
        return c;
      });
      loadAll(activeId);
    }
  }

  const suggestions = reqs.filter((r) => r.suggested_owner && r.suggested_owner !== r.owner);
  const groups = new Map<string, Deliv[]>();
  for (const d of delivs) {
    const key = d.owner ?? "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  if (tenders.length === 0) {
    return (
      <Shell>
        <div className="mb-4 rounded-[10px] border border-[#E2E8F0] bg-white p-6 text-center text-sm">
          <strong>No tenders yet.</strong> Upload an ITT on the Overview page, run extraction, then assign owners here.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm font-bold">Tender:</label>
        <select value={activeId ?? ""} onChange={(e) => { setActiveId(e.target.value); loadAll(e.target.value); }} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm">
          {tenders.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
        </select>
        <span className="text-sm text-[#5B6472]">{Object.keys(overdueByOwner).length ? Object.entries(overdueByOwner).map(([o, n]) => `${o}: ${n} overdue`).join(" · ") : "No overdue items — nothing to chase."}</span>
      </div>
      {notice && <p className="mb-3 text-sm font-bold text-[#DC2626]">{notice}</p>}

      {(overdue.length > 0 || dueSoon.length > 0) && (
        <Panel title={`Reminders — ${overdue.length} overdue · ${dueSoon.length} due within 3 days`}>
          <ul className="divide-y divide-[#E2E8F0]">
            {[...overdue, ...dueSoon].map((m) => (
              <li key={m.deliverable_id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Badge tone={m.overdue ? "red" : "amber"}>{m.overdue ? "■ Overdue" : "▲ Due soon"}</Badge>
                <span className="font-semibold">{m.title}</span>
                <span className="text-[#5B6472]">{m.owner} · due {m.due_date} · {m.status}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {suggestions.length > 0 && (
        <Panel title={`Suggested owners awaiting confirmation (${suggestions.length})`}>
          <ul className="divide-y divide-[#E2E8F0]">
            {suggestions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-semibold">{r.title}</span>
                <span className="text-[#5B6472]">suggested: <strong>{r.suggested_owner}</strong>{r.owner ? ` · current: ${r.owner}` : ""}</span>
                <button onClick={() => assign(r.id, r.suggested_owner!)} className="rounded bg-[#1D4C8D] px-3 py-1 text-xs font-bold text-white">Accept</button>
                {changeFor[r.id] !== undefined ? (
                  <span className="flex gap-1">
                    <input value={changeFor[r.id]} onChange={(e) => setChangeFor((s) => ({ ...s, [r.id]: e.target.value }))} placeholder="Owner name" className="w-36 rounded border border-[#E2E8F0] px-2 py-1 text-xs" aria-label="Change owner" />
                    <button onClick={() => assign(r.id, changeFor[r.id])} className="rounded border border-[#E2E8F0] px-2 py-1 text-xs font-bold">Save</button>
                  </span>
                ) : (
                  <button onClick={() => setChangeFor((s) => ({ ...s, [r.id]: r.owner ?? "" }))} className="rounded border border-[#E2E8F0] px-2 py-1 text-xs font-bold">Change</button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {[...groups.entries()].map(([owner, items]) => (
        <Panel key={owner} title={`${owner} — ${items.length} items`}>
          <ul className="divide-y divide-[#E2E8F0]">
            {items.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                <button onClick={() => openDeliv(d.id)} className="flex w-full flex-wrap items-center gap-2 text-left">
                  <span className="font-semibold">{open === d.id ? "▾" : "▸"} {d.title}</span>
                  <Badge tone={toneFor(d.status)}>{d.status}</Badge>
                  {d.due_date && <span className="text-xs text-[#5B6472]">due {d.due_date}</span>}
                  {(evidence[d.id]?.length ?? 0) > 0 && <Badge tone="blue">{evidence[d.id].length} file{(evidence[d.id].length ?? 0) === 1 ? "" : "s"}</Badge>}
                  {(comments[d.id]?.length ?? 0) > 0 && <Badge tone="purple">{comments[d.id].length} note{(comments[d.id].length ?? 0) === 1 ? "" : "s"}</Badge>}
                </button>
                {open === d.id && (
                  <div className="ml-4 mt-2 rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={d.status} onChange={(e) => patchDeliv(d.id, { status: e.target.value })} className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-xs" aria-label="Set status">
                        {["outstanding", "in-progress", "received", "complete"].map((s) => (<option key={s}>{s}</option>))}
                      </select>
                      <input type="date" value={d.due_date ?? ""} onChange={(e) => patchDeliv(d.id, { due_date: e.target.value || null })} className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-xs" aria-label="Set due date" />
                      <label className="cursor-pointer rounded border border-[#E2E8F0] bg-white px-2 py-1 text-xs font-bold">
                        Upload evidence
                        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadEvidence(d.id, f); e.target.value = ""; }} />
                      </label>
                    </div>
                    {(evidence[d.id] ?? []).length > 0 && (
                      <ul className="mt-2 text-xs">
                        {(evidence[d.id] ?? []).map((f) => (<li key={f.id}>📎 {f.file_name} <span className="text-[#5B6472]">{new Date(f.created_at).toLocaleString()}</span></li>))}
                      </ul>
                    )}
                    <div className="mt-2">
                      {(comments[d.id] ?? []).map((c) => (
                        <div key={c.id} className="mt-1 rounded border border-[#E2E8F0] bg-white p-2 text-xs">
                          <strong>{c.author}</strong> · <Badge tone={c.kind === "issue" ? "red" : c.kind === "clarification_request" ? "amber" : "grey"}>{c.kind.replace("_", " ")}</Badge>
                          <div className="mt-1">{c.body}</div>
                        </div>
                      ))}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <select value={commentKind[d.id] ?? "comment"} onChange={(e) => setCommentKind((s) => ({ ...s, [d.id]: e.target.value }))} className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-xs" aria-label="Note kind">
                          <option value="comment">comment</option>
                          <option value="issue">flag issue</option>
                          <option value="clarification_request">request clarification</option>
                        </select>
                        <input value={commentDraft[d.id] ?? ""} onChange={(e) => setCommentDraft((s) => ({ ...s, [d.id]: e.target.value }))} placeholder="Add a note…" className="min-w-[200px] flex-1 rounded border border-[#E2E8F0] px-2 py-1 text-xs" aria-label="Add a note" />
                        <button onClick={() => postComment(d.id)} className="rounded bg-[#1D4C8D] px-3 py-1 text-xs font-bold text-white">Post</button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </Shell>
  );
}
