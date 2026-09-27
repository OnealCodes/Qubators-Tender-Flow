"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";

interface Doc {
  id: string;
  name: string;
  doc_type: string;
  version: string;
  version_no: number;
  superseded: boolean;
  expiry_date: string | null;
  dept: string | null;
  entity: string | null;
  status: string;
}

interface Candidate {
  library_doc_id: string;
  name: string;
  confidence: string;
  reasons: string[];
  status: string;
  expiry_badge: { level: string; label: string };
}

interface MatchGroup {
  deliverable_id: string;
  title: string;
  owner: string | null;
  candidates: Candidate[];
}

interface ExpiryRow extends Doc {
  expiry: { level: string; label: string };
}

function badgeFor(level: string) {
  return level === "red" ? "red" : level === "amber" ? "amber" : level === "green" ? "green" : "grey";
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState("");
  const [tenders, setTenders] = useState<{ id: string; title: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchGroup[]>([]);
  const [expiry, setExpiry] = useState<{ docs: ExpiryRow[]; counts: Record<string, number>; submission_deadline: string | null }>({ docs: [], counts: {}, submission_deadline: null });
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [meta, setMeta] = useState({ doc_type: "certificate", expiry_date: "", dept: "", entity: "" });
  const [editExpiry, setEditExpiry] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    const j = await fetch("/api/library").then((r) => r.json());
    setDocs(j.docs ?? []);
  }, []);

  const loadTender = useCallback(async (id: string) => {
    const [m, e] = await Promise.all([
      fetch(`/api/tenders/${id}/matches`).then((r) => r.json()),
      fetch(`/api/tenders/${id}/expiry`).then((r) => r.json()),
    ]);
    setMatches(m.matches ?? []);
    setExpiry({ docs: e.docs ?? [], counts: e.counts ?? {}, submission_deadline: e.submission_deadline ?? null });
  }, []);

  useEffect(() => {
    loadDocs();
    fetch("/api/tenders")
      .then((r) => r.json())
      .then((j) => {
        setTenders(j.tenders ?? []);
        if (j.tenders?.length) {
          setActiveId(j.tenders[0].id);
          loadTender(j.tenders[0].id);
        }
      })
      .catch(() => {});
  }, [loadDocs, loadTender]);

  useEffect(() => {
    const h = (e: Event) => setQ(((e as CustomEvent<string>).detail ?? "").toLowerCase());
    window.addEventListener("tf-search", h);
    return () => window.removeEventListener("tf-search", h);
  }, []);

  async function upload(file: File) {
    setNotice(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("doc_type", meta.doc_type);
      if (meta.expiry_date) fd.append("expiry_date", meta.expiry_date);
      if (meta.dept) fd.append("dept", meta.dept);
      if (meta.entity) fd.append("entity", meta.entity);
      const r = await fetch("/api/library", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) setNotice(j.error ?? "Upload failed.");
      else {
        setNotice(j.deduped ? `Saved as new version (${j.doc.version}) — old row superseded.` : "Saved to the library.");
        loadDocs();
      }
    } catch {
      setNotice("Upload failed — network error.");
    } finally {
      setUploading(false);
    }
  }

  async function decide(deliverable_id: string, library_doc_id: string, accept: boolean) {
    if (!activeId) return;
    await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliverable_id, library_doc_id, accept, tender_id: activeId }),
    });
    loadTender(activeId);
  }

  async function saveExpiry(id: string) {
    const v = editExpiry[id];
    if (v === undefined) return;
    await fetch(`/api/library/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiry_date: v || null }),
    });
    setEditExpiry((s) => {
      const c = { ...s };
      delete c[id];
      return c;
    });
    loadDocs();
  }

  async function removeDoc(id: string, name: string) {
    if (!confirm(`Delete "${name}" from the library?`)) return;
    await fetch(`/api/library/${id}`, { method: "DELETE" });
    loadDocs();
  }

  const rows = docs.filter((d) => !q || `${d.name} ${d.doc_type} ${d.entity ?? ""}`.toLowerCase().includes(q));

  return (
    <Shell>
      <h1 className="mb-4 text-2xl font-extrabold">Company document library</h1>

      <Panel title="Add to library">
        <div className="flex flex-wrap items-end gap-2 py-2 text-sm">
          <label>File <input ref={inputRef} type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} className="block text-xs" /></label>
          <label>Type <input value={meta.doc_type} onChange={(e) => setMeta({ ...meta, doc_type: e.target.value })} className="block w-36 rounded border border-[#E2E8F0] px-2 py-1 text-xs" /></label>
          <label>Expiry <input type="date" value={meta.expiry_date} onChange={(e) => setMeta({ ...meta, expiry_date: e.target.value })} className="block rounded border border-[#E2E8F0] px-2 py-1 text-xs" /></label>
          <label>Dept <input value={meta.dept} onChange={(e) => setMeta({ ...meta, dept: e.target.value })} placeholder="Finance" className="block w-32 rounded border border-[#E2E8F0] px-2 py-1 text-xs" /></label>
          <label>Entity <input value={meta.entity} onChange={(e) => setMeta({ ...meta, entity: e.target.value })} placeholder="NUPRC" className="block w-32 rounded border border-[#E2E8F0] px-2 py-1 text-xs" /></label>
        </div>
        {uploading && <p className="py-1 text-sm font-semibold">Saving…</p>}
        {notice && <p className="py-1 text-sm text-[#5B6472]">{notice}</p>}
        <p className="py-1 text-xs text-[#5B6472]">Same name + entity starts a new version and supersedes the old row — no silent duplicates.</p>
      </Panel>

      <Panel title={`Reusable documents (${rows.length})`}>
        <div className="overflow-x-auto">
          <table className="matrix-table w-full min-w-[760px] text-sm" aria-label="Document library">
            <thead><tr>{["Document", "Type", "Version", "Expiry", "Entity", "Status", ""].map((h) => (<th key={h} className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className={`border-t border-[#E2E8F0] ${d.superseded ? "bg-[#F4F6F8] text-[#5B6472]" : "bg-white"}`}>
                  <td className="px-3.5 py-3.5 font-bold">{d.name}{d.superseded && <span className="ml-2 text-xs">(superseded)</span>}</td>
                  <td className="px-3.5 py-3.5">{d.doc_type}</td>
                  <td className="px-3.5 py-3.5 font-mono text-xs">{d.version}</td>
                  <td className="px-3.5 py-3.5">
                    {editExpiry[d.id] !== undefined ? (
                      <span className="flex gap-1">
                        <input type="date" value={editExpiry[d.id]} onChange={(e) => setEditExpiry((s) => ({ ...s, [d.id]: e.target.value }))} className="rounded border border-[#E2E8F0] px-1 py-0.5 text-xs" aria-label="Edit expiry" />
                        <button onClick={() => saveExpiry(d.id)} className="rounded bg-[#1D4C8D] px-2 py-0.5 text-xs font-bold text-white">Save</button>
                      </span>
                    ) : (
                      <span>{d.expiry_date ?? "—"} <button onClick={() => setEditExpiry((s) => ({ ...s, [d.id]: d.expiry_date ?? "" }))} className="text-xs font-bold text-[#1D4C8D] underline">Edit</button></span>
                    )}
                  </td>
                  <td className="px-3.5 py-3.5">{d.entity ?? "—"}</td>
                  <td className="px-3.5 py-3.5"><Badge tone={d.superseded ? "grey" : "green"}>{d.superseded ? "Superseded" : d.status}</Badge></td>
                  <td className="px-3.5 py-3.5"><button onClick={() => removeDoc(d.id, d.name)} className="text-xs font-bold text-[#DC2626] underline">Delete</button></td>
                </tr>
              ))}
              {rows.length === 0 && (<tr><td colSpan={7} className="px-3.5 py-4 text-center text-sm text-[#5B6472]">Library is empty — add the reusable certificates above.</td></tr>)}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold">Matching + expiry</h2>
        {tenders.length > 0 && (
          <select value={activeId ?? ""} onChange={(e) => { setActiveId(e.target.value); loadTender(e.target.value); }} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Select tender">
            {tenders.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
          </select>
        )}
        <span className="text-xs text-[#5B6472]">Matches suggest — they never approve. Expiry dashboard checks against the tender submission date.</span>
      </div>

      <Panel title={`Suggested matches (${matches.length} deliverables)`}>
        {matches.length === 0 ? (
          <p className="py-3 text-sm text-[#5B6472]">No candidates right now — every deliverable either has an accepted document or nothing in the library scores above low. Add more library documents to get suggestions.</p>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {matches.map((m) => (
              <li key={m.deliverable_id} className="py-2 text-sm">
                <div className="font-bold">{m.title} <span className="font-normal text-[#5B6472]">({m.owner ?? "Unassigned"})</span></div>
                {m.candidates.map((c) => (
                  <div key={c.library_doc_id} className="ml-4 mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] p-2">
                    <span className="font-semibold">{c.name}</span>
                    <Badge tone={c.confidence === "high" ? "green" : "amber"}>{c.confidence} confidence</Badge>
                    <Badge tone={badgeFor(c.expiry_badge.level)}>{c.expiry_badge.label}</Badge>
                    <span className="w-full text-xs text-[#5B6472]">{c.reasons.join(" · ")}</span>
                    <button onClick={() => decide(m.deliverable_id, c.library_doc_id, true)} className="rounded bg-[#1D4C8D] px-3 py-1 text-xs font-bold text-white">Use this document</button>
                    <button onClick={() => decide(m.deliverable_id, c.library_doc_id, false)} className="rounded border border-[#E2E8F0] px-3 py-1 text-xs font-bold">Reject</button>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Expiry dashboard${expiry.submission_deadline ? ` — submission ${expiry.submission_deadline}` : ""}`} right={<><Badge tone="red">■ {expiry.counts.red ?? 0} red</Badge><Badge tone="amber">▲ {expiry.counts.amber ?? 0} amber</Badge><Badge tone="green">● {expiry.counts.green ?? 0} valid</Badge></>}>
        <div className="overflow-x-auto">
          <table className="matrix-table w-full min-w-[640px] text-sm" aria-label="Expiry dashboard">
            <thead><tr>{["Document", "Expiry", "Check"].map((h) => (<th key={h} className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {expiry.docs.map((d) => (
                <tr key={d.id} className="border-t border-[#E2E8F0] bg-white">
                  <td className="px-3.5 py-3.5 font-bold">{d.name}</td>
                  <td className="px-3.5 py-3.5">{d.expiry_date ?? "—"}</td>
                  <td className="px-3.5 py-3.5"><Badge tone={badgeFor(d.expiry.level)}>{d.expiry.label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Shell>
  );
}
