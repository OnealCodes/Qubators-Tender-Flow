"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "../components/shell";
import { Badge } from "../components/ui";
import { matrix as demoMatrix, readiness, singleRows, tender as demoTender } from "../lib/demo-data";
import type { Deliverable, Requirement, RunDiff } from "../lib/requirements";

interface TenderOpt {
  id: string;
  title: string;
  client: string | null;
  page_count: number;
}

const toneForType = (t: string) => (t === "conditional" ? "purple" : t === "form" ? "blue" : t === "action" ? "amber" : t === "evidence" ? "blue" : "grey");
const toneForRisk = (r: string) => (r === "critical" ? "red" : r === "mandatory" ? "blue" : r === "conditional" ? "purple" : "grey");
const toneForStatus = (s: string) =>
  /received|complete|compliant/i.test(s) ? "green" : /progress|review/i.test(s) ? "amber" : "grey";

export default function MatrixPage() {
  const [tenders, setTenders] = useState<TenderOpt[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reqs, setReqs] = useState<Requirement[]>([]);
  const [delivs, setDelivs] = useState<Deliverable[]>([]);
  const [diff, setDiff] = useState<RunDiff | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fSection, setFSection] = useState("");
  const [fType, setFType] = useState("");
  const [fRisk, setFRisk] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, { title: string; owner: string; status: string }>>({});

  useEffect(() => {
    const h = (e: Event) => setQuery((e as CustomEvent<string>).detail ?? "");
    window.addEventListener("tf-search", h);
    return () => window.removeEventListener("tf-search", h);
  }, []);

  const loadReqs = useCallback(async (id: string) => {
    const r = await fetch(`/api/tenders/${id}/extract`).then((x) => x.json());
    setReqs(r.requirements ?? []);
    setDelivs(r.deliverables ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/tenders")
      .then((r) => r.json())
      .then((j) => {
        setTenders(j.tenders ?? []);
        if (j.tenders?.length) {
          setActiveId(j.tenders[0].id);
          loadReqs(j.tenders[0].id);
        }
      })
      .catch(() => {});
  }, [loadReqs]);

  async function runExtraction() {
    if (!activeId) return;
    setRunning(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/tenders/${activeId}/extract`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setNotice(j.error ?? "Extraction failed.");
      } else {
        setDiff(j.diff);
        await loadReqs(activeId);
      }
    } catch {
      setNotice("Extraction failed — network error.");
    } finally {
      setRunning(false);
    }
  }

  async function saveEdit(id: string) {
    const e = editing[id];
    if (!e) return;
    const r = await fetch(`/api/requirements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: e.title, owner: e.owner || null, status: e.status }),
    });
    if (r.ok) {
      const j = await r.json();
      setReqs((all) => all.map((x) => (x.id === id ? j.requirement : x)));
      setEditing((s) => {
        const c = { ...s };
        delete c[id];
        return c;
      });
    }
  }

  const sections = useMemo(() => [...new Set(reqs.map((r) => r.section))], [reqs]);
  const q = query.toLowerCase();
  const filtered = reqs.filter(
    (r) =>
      (!fSection || r.section === fSection) &&
      (!fType || r.type === fType) &&
      (!fRisk || r.risk === fRisk) &&
      (!fStatus || r.status === fStatus) &&
      (!q || `${r.title} ${r.owner ?? ""} ${r.section}`.toLowerCase().includes(q))
  );
  const delivCount = useMemo(() => {
    const ids = new Set(filtered.map((r) => r.id));
    return delivs.filter((d) => ids.has(d.requirement_id)).length;
  }, [filtered, delivs]);
  const missing = filtered.filter((r) => r.type !== "conditional" && !/received|complete/i.test(r.status)).length;

  // No uploaded tenders yet → keep the Phase 0 demo matrix working.
  if (tenders.length === 0) {
    return (
      <Shell>
        <div className="mb-4 rounded-[10px] border border-[#E2E8F0] bg-white p-6 text-center">
          <h1 className="text-xl font-extrabold">No tenders yet — upload one to build the matrix</h1>
          <p className="mt-1 text-sm text-[#5B6472]">Go to <Link href="/overview" className="font-bold underline">Overview → Upload ITT package</Link>, then come back and run extraction. Meanwhile the <span className="font-mono">design.html</span> demo still shows the target look.</p>
        </div>
        <DemoMatrix />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm font-bold">Tender:</label>
        <select value={activeId ?? ""} onChange={(e) => { setActiveId(e.target.value); setDiff(null); loadReqs(e.target.value); }} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm">
          {tenders.map((t) => (<option key={t.id} value={t.id}>{t.title} ({t.page_count}p)</option>))}
        </select>
        <button onClick={runExtraction} disabled={running} className="rounded-lg bg-[#1D4C8D] px-4 py-2 text-sm font-bold text-white hover:bg-[#14365F] disabled:opacity-50">
          {running ? "Extracting…" : reqs.length ? "Re-run extraction" : "Run extraction"}
        </button>
        {diff && <span className="text-sm text-[#5B6472]">v{diff.version}: +{diff.added} new · −{diff.removed} removed · {diff.carried_edited} hand-edits kept</span>}
      </div>
      {notice && <p className="mb-3 text-sm font-bold text-[#DC2626]">{notice}</p>}

      {reqs.length === 0 ? (
        <div className="mb-4 rounded-[10px] border border-[#E2E8F0] bg-white p-6 text-center text-sm">
          <strong>No requirements extracted yet.</strong> Click <strong>Run extraction</strong> to build the responsibility matrix from the parsed pages (heuristic v1 — you verify every row).
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <select value={fSection} onChange={(e) => setFSection(e.target.value)} className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5" aria-label="Filter by section">
              <option value="">All sections</option>{sections.map((s) => (<option key={s}>{s}</option>))}
            </select>
            <select value={fType} onChange={(e) => setFType(e.target.value)} className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5" aria-label="Filter by type">
              <option value="">All types</option>{["doc", "info", "form", "evidence", "action", "conditional"].map((t) => (<option key={t}>{t}</option>))}
            </select>
            <select value={fRisk} onChange={(e) => setFRisk(e.target.value)} className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5" aria-label="Filter by risk">
              <option value="">All risks</option>{["critical", "mandatory", "conditional", "supporting", "info"].map((t) => (<option key={t}>{t}</option>))}
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5" aria-label="Filter by status">
              <option value="">All statuses</option>{["outstanding", "in-progress", "received", "complete"].map((t) => (<option key={t}>{t}</option>))}
            </select>
            <span className="ml-auto text-[#5B6472]">{filtered.length} requirements · {delivCount} deliverables · {missing} missing (conditional excluded)</span>
          </div>

          <div className="mb-4 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
            <div className="overflow-x-auto">
              <table className="matrix-table w-full min-w-[960px] text-[14.5px]" aria-label="Requirements matrix">
                <thead><tr>{["Section", "Requirement / Deliverables", "Owner", "Due", "Status", "QC", "Source"].map((h) => (<th key={h} className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">{h}</th>))}</tr></thead>
                <tbody>
                  {filtered.map((r) => {
                    const items = delivs.filter((d) => d.requirement_id === r.id);
                    const isCollapsed = !!collapsed[r.id];
                    const e = editing[r.id];
                    return (
                      <>
                        <tr key={r.id} className="border-t-2 border-[#CBD5E1] bg-white">
                          <td className="px-3.5 py-3.5 align-top"><Badge tone="blue">{r.section}</Badge></td>
                          <td className="px-3.5 py-3.5 align-top">
                            <button onClick={() => setCollapsed((s) => ({ ...s, [r.id]: !s[r.id] }))} className="font-extrabold">
                              {isCollapsed ? "▸" : "▾"} {r.title}
                            </button>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge tone={toneForType(r.type)}>{r.type}</Badge>
                              <Badge tone={toneForRisk(r.risk)}>{r.risk}</Badge>
                              {r.edited && <Badge tone="amber">✎ hand-edited</Badge>}
                            </div>
                            <div className="mt-1 text-[13px] text-[#4B5563]">{items.length} deliverable{items.length === 1 ? "" : "s"}{r.risk_reason ? ` · ${r.risk_reason}` : ""}</div>
                            {e ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <input value={e.title} onChange={(ev) => setEditing((s) => ({ ...s, [r.id]: { ...e, title: ev.target.value } }))} className="w-64 rounded border border-[#E2E8F0] px-2 py-1 text-sm" aria-label="Edit title" />
                                <input value={e.owner} onChange={(ev) => setEditing((s) => ({ ...s, [r.id]: { ...e, owner: ev.target.value } }))} placeholder="Owner" className="w-32 rounded border border-[#E2E8F0] px-2 py-1 text-sm" aria-label="Edit owner" />
                                <select value={e.status} onChange={(ev) => setEditing((s) => ({ ...s, [r.id]: { ...e, status: ev.target.value } }))} className="rounded border border-[#E2E8F0] px-2 py-1 text-sm" aria-label="Edit status">
                                  {["outstanding", "in-progress", "received", "complete"].map((s) => (<option key={s}>{s}</option>))}
                                </select>
                                <button onClick={() => saveEdit(r.id)} className="rounded bg-[#1D4C8D] px-3 py-1 text-sm font-bold text-white">Save</button>
                                <button onClick={() => setEditing((s) => { const c = { ...s }; delete c[r.id]; return c; })} className="rounded border border-[#E2E8F0] px-3 py-1 text-sm">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setEditing((s) => ({ ...s, [r.id]: { title: r.title, owner: r.owner ?? "", status: r.status } }))} className="mt-1 text-xs font-bold text-[#1D4C8D] underline">Edit</button>
                            )}
                          </td>
                          <td className="px-3.5 py-3.5 align-top">{r.owner ?? <span className="text-[#5B6472]">—</span>}{r.suggested_owner && !r.owner ? <span className="block text-xs text-[#5B6472]">suggested: {r.suggested_owner}</span> : null}</td>
                          <td className="px-3.5 py-3.5 align-top">{r.due_date ?? "—"}</td>
                          <td className="px-3.5 py-3.5 align-top"><Badge tone={toneForStatus(r.status)}>{r.status}</Badge></td>
                          <td className="px-3.5 py-3.5 align-top"><Badge tone="grey">○ Not reviewed</Badge></td>
                          <td className="px-3.5 py-3.5 align-top">{r.source_page != null ? <span className="whitespace-nowrap rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-xs">p.{r.source_page}</span> : "—"}</td>
                        </tr>
                        {!isCollapsed && items.map((d) => (
                          <tr key={d.id} className="border-t border-[#E2E8F0] bg-[#F4F6F8]">
                            <td className="px-3.5 py-3.5"></td>
                            <td className="px-3.5 py-3.5">{d.title} <span className="text-[13px] text-[#4B5563]">{d.expected_detail ?? ""}</span></td>
                            <td className="px-3.5 py-3.5">{d.owner ?? "—"}</td>
                            <td className="px-3.5 py-3.5">{d.due_date ?? "—"}</td>
                            <td className="px-3.5 py-3.5"><Badge tone={toneForStatus(d.status)}>{d.status}</Badge></td>
                            <td className="px-3.5 py-3.5"><Badge tone="grey">○ Not reviewed</Badge></td>
                            <td className="px-3.5 py-3.5"></td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

function DemoMatrix() {
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {readiness.map((c) => (
          <div key={c.label} className="rounded-[10px] border border-[#E2E8F0] bg-white p-3.5">
            <div className="text-xs font-bold uppercase tracking-wider text-[#5B6472]">{c.label}</div>
            <div className="my-1 text-[26px] font-extrabold">{c.value}</div>
            <div className="text-[13px] text-[#5B6472]">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="mb-4 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
        <div className="border-b border-[#E2E8F0] p-3.5"><h2 className="text-base font-bold">Demo matrix — {demoTender.client} (target look)</h2></div>
        <div className="overflow-x-auto">
          <table className="matrix-table w-full min-w-[960px] text-[14.5px]" aria-label="Demo requirements matrix">
            <thead><tr>{["Section", "Requirement", "Owner", "Status"].map((h) => (<th key={h} className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {demoMatrix.map((g) => (
                <tr key={g.id} className="border-t border-[#E2E8F0] bg-white">
                  <td className="px-3.5 py-3.5"><Badge tone={g.sectionTone}>{g.section}</Badge></td>
                  <td className="px-3.5 py-3.5 font-bold">{g.title}<span className="block text-[13px] font-normal text-[#4B5563]">{g.subtitle}</span></td>
                  <td className="px-3.5 py-3.5">{g.owner}</td>
                  <td className="px-3.5 py-3.5"><Badge tone={g.statusTone}>{g.status}</Badge></td>
                </tr>
              ))}
              {singleRows.map((r) => (
                <tr key={r.title} className="border-t border-[#E2E8F0] bg-white">
                  <td className="px-3.5 py-3.5"><Badge tone={r.tone}>{r.section}</Badge></td>
                  <td className="px-3.5 py-3.5 font-bold">{r.title}</td>
                  <td className="px-3.5 py-3.5">{r.owner}</td>
                  <td className="px-3.5 py-3.5"><Badge tone="grey">{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
