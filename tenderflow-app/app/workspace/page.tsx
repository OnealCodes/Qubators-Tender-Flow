"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Shell from "../../components/shell";
import { Badge } from "../../components/ui";
import { matrix as demoMatrix, readiness, singleRows, tender as demoTender } from "../../lib/demo-data";
import type { Deliverable, Requirement, RunDiff } from "../../lib/requirements";

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
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fSection, setFSection] = useState("");
  const [fType, setFType] = useState("");
  const [fRisk, setFRisk] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fEnvelope, setFEnvelope] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, { title: string; owner: string; status: string }>>({});
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiModel, setAiModel] = useState("");
  const [aiRunning, setAiRunning] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ run_id: string; model: string; keep: number; drop: number } | null>(null);
  const [assessments, setAssessments] = useState<Record<string, { verdict: string; class: string; detail: string; applied: boolean }>>({});

  useEffect(() => {
    const h = (e: Event) => {
      setQuery((e as CustomEvent<string>).detail ?? "");
      setPage(0);
    };
    window.addEventListener("tf-search", h);
    return () => window.removeEventListener("tf-search", h);
  }, []);

  const loadReqs = useCallback(async (id: string) => {
    const r = await fetch(`/api/tenders/${id}/extract`).then((x) => x.json());
    setReqs(r.requirements ?? []);
    setDelivs(r.deliverables ?? []);
  }, []);

  const loadAi = useCallback(async (id: string) => {
    try {
      const j = await fetch(`/api/tenders/${id}/ai`).then((x) => x.json());
      const map: Record<string, { verdict: string; class: string; detail: string; applied: boolean }> = {};
      for (const a of j.assessments ?? []) {
        if (!map[a.requirement_id]) map[a.requirement_id] = a;
      }
      setAssessments(map);
    } catch { /* AI panel stays empty */ }
  }, []);

  useEffect(() => {
    fetch("/api/admin/ai-status")
      .then((r) => r.json())
      .then((j) => {
        setAiConfigured(!!j.configured);
        setAiModel(j.model ?? "");
      })
      .catch(() => {});
    fetch("/api/tenders")
      .then((r) => r.json())
      .then((j) => {
        setTenders(j.tenders ?? []);
        if (j.tenders?.length) {
          setActiveId(j.tenders[0].id);
          loadReqs(j.tenders[0].id);
          loadAi(j.tenders[0].id);
        }
      })
      .catch(() => {});
  }, [loadReqs, loadAi]);

  const [meta, setMeta] = useState<{
    weights?: { criterion: string; weight: string }[];
    skipped_post_award?: number;
    skipped_evaluation?: number;
    ai_structured_from?: string[];
    rejected?: number;
    engine_note?: string;
  } | null>(null);

  async function runExtraction() {
    if (!activeId) return;
    setRunning(true);
    setNotice(null);
    setAiNotice(null);
    try {
      const r = await fetch(`/api/tenders/${activeId}/extract`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setNotice(j.error ?? "Extraction failed.");
      } else {
        setDiff(j.diff);
        setMeta(j.meta ?? null);
        if (j.ai?.ran) {
          const from = Array.isArray(j.meta?.ai_structured_from) ? j.meta.ai_structured_from.join(", §") : "";
          setAiNotice(`AI-structured${from ? ` from §${from}` : ""} — exact tender wording, verified.`);
        } else if (j.ai?.reason) {
          setAiNotice(j.ai.reason);
        }
        await loadReqs(activeId);
      }
    } catch {
      setNotice("Extraction failed — network error.");
    } finally {
      setRunning(false);
    }
  }

  async function runAiRefine() {
    if (!activeId) return;
    setAiRunning(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/tenders/${activeId}/ai`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setNotice(j.error ?? "AI refinement failed.");
      } else {
        setAiSummary(j.summary ?? null);
        await loadAi(activeId);
      }
    } catch {
      setNotice("AI refinement failed — network error.");
    } finally {
      setAiRunning(false);
    }
  }

  async function runAiStructure() {
    if (!activeId) return;
    setAiRunning(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/tenders/${activeId}/extract/ai`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setNotice(j.error ?? "AI structuring failed.");
      } else {
        setDiff(j.diff);
        setMeta(j.meta ?? null);
        await loadReqs(activeId);
      }
    } catch {
      setNotice("AI structuring failed — network error.");
    } finally {
      setAiRunning(false);
    }
  }

  async function applyAiDrops() {
    if (!activeId) return;
    setAiRunning(true);
    try {
      const r = await fetch(`/api/tenders/${activeId}/ai`, { method: "PUT" });
      const j = await r.json();
      if (r.ok) {
        setNotice(`AI cleanup applied — ${j.applied} suggested row(s) removed. Re-run extraction any time to restore.`);
        await loadReqs(activeId);
        await loadAi(activeId);
      } else {
        setNotice(j.error ?? "Apply failed.");
      }
    } finally {
      setAiRunning(false);
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
  const [fUnassigned, setFUnassigned] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const filtered = reqs
    .filter(
      (r) =>
        (!fSection || r.section === fSection) &&
        (!fEnvelope || (r.envelope ?? "Technical") === fEnvelope) &&
        (!fType || r.type === fType) &&
        (!fRisk || r.risk === fRisk) &&
        (!fStatus || r.status === fStatus) &&
        (!fUnassigned || !r.owner) &&
        (!q || `${r.ref ?? ""} ${r.title} ${r.owner ?? ""} ${r.section}`.toLowerCase().includes(q))
    )
    .sort((a, b) => (a.envelope ?? "Technical") === (b.envelope ?? "Technical") ? 0 : (a.envelope ?? "Technical") === "Technical" ? -1 : 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
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
        <select value={activeId ?? ""} onChange={(e) => { setActiveId(e.target.value); setDiff(null); setMeta(null); setAiSummary(null); setPage(0); loadReqs(e.target.value); loadAi(e.target.value); }} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm">
          {tenders.map((t) => (<option key={t.id} value={t.id}>{t.title} ({t.page_count}p)</option>))}
        </select>
        <button onClick={runExtraction} disabled={running} className="rounded-lg bg-[#1D4C8D] px-4 py-2 text-sm font-bold text-white hover:bg-[#14365F] disabled:opacity-50">
          {running ? "Extracting…" : reqs.length ? "Re-run extraction" : "Run extraction"}
        </button>
        {aiConfigured ? (
          <>
            <button onClick={runAiRefine} disabled={aiRunning || reqs.length === 0} className="rounded-lg bg-[#F5B301] px-4 py-2 text-sm font-extrabold text-[#0A2C4E] hover:bg-[#FFC81A] disabled:opacity-50" title="Gemini reviews the heuristic rows and suggests drops — nothing changes until you Apply">
              {aiRunning ? "AI working…" : "AI refine"}
            </button>
            <button onClick={runAiStructure} disabled={aiRunning} className="rounded-lg border border-[#F5B301] bg-white px-4 py-2 text-sm font-bold text-[#0A2C4E] hover:bg-[#FFF6DE] disabled:opacity-50" title="Gemini finds the bid sections and structures exact-wording rows only from them">
              {aiRunning ? "AI working…" : "AI structure"}
            </button>
          </>
        ) : (
          <span className="text-xs text-[#5B6472]" title="Add GEMINI_API_KEY to tenderflow-app/.env to enable">AI refine: key missing</span>
        )}
        {aiSummary && (
          <span className="text-sm text-[#5B6472]">
            · AI ({aiSummary.model}): {aiSummary.keep} keep · {aiSummary.drop} drop suggested{" "}
            {aiSummary.drop > 0 && (
              <button onClick={applyAiDrops} disabled={aiRunning} className="font-bold text-[#1D4C8D] underline disabled:opacity-50">
                Apply drops
              </button>
            )}
          </span>
        )}
        {diff && <span className="text-sm text-[#5B6472]">v{diff.version}: +{diff.added} new · −{diff.removed} removed · {diff.carried_edited} hand-edits kept</span>}
        {meta && !meta.ai_structured_from && ((meta.weights?.length ?? 0) > 0 || (meta.skipped_post_award ?? 0) > 0) && (
          <span className="text-sm text-[#5B6472]">
            eval weights: {(meta.weights ?? []).map((w) => `${w.criterion} ${w.weight}`).slice(0, 3).join("; ")}
            {(meta.weights?.length ?? 0) > 3 ? "…" : ""} · post-award set aside: {meta.skipped_post_award ?? 0}
          </span>
        )}
        {aiNotice && <span className="text-sm font-semibold text-[#0A2C4E]">{aiNotice}</span>}
      </div>
      {notice && <p className="mb-3 text-sm font-bold text-[#DC2626]">{notice}</p>}

      {reqs.length === 0 ? (
        <div className="mb-4 rounded-[10px] border border-[#E2E8F0] bg-white p-6 text-center text-sm">
          <strong>No requirements extracted yet.</strong> Click <strong>Run extraction</strong> to build the responsibility matrix from the parsed pages (heuristic v1 — you verify every row).
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <select value={fSection} onChange={(e) => { setFSection(e.target.value); setPage(0); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5" aria-label="Filter by section">
              <option value="">All sections</option>{sections.map((s) => (<option key={s}>{s}</option>))}
            </select>
            <select value={fEnvelope} onChange={(e) => { setFEnvelope(e.target.value); setPage(0); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5" aria-label="Filter by envelope">
              <option value="">Technical + Commercial</option>
              <option value="Technical">Technical only</option>
              <option value="Commercial">Commercial only</option>
            </select>
            <select value={fType} onChange={(e) => { setFType(e.target.value); setPage(0); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5" aria-label="Filter by type">
              <option value="">All types</option>{["doc", "info", "form", "evidence", "action", "conditional"].map((t) => (<option key={t}>{t}</option>))}
            </select>
            <select value={fRisk} onChange={(e) => { setFRisk(e.target.value); setPage(0); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5" aria-label="Filter by risk">
              <option value="">All risks</option>{["critical", "mandatory", "conditional", "supporting", "info"].map((t) => (<option key={t}>{t}</option>))}
            </select>
            <select value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(0); }} className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5" aria-label="Filter by status">
              <option value="">All statuses</option>{["outstanding", "in-progress", "received", "complete"].map((t) => (<option key={t}>{t}</option>))}
            </select>
            <label className="flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5">
              <input type="checkbox" checked={fUnassigned} onChange={(e) => { setFUnassigned(e.target.checked); setPage(0); }} aria-label="Show unassigned only" />
              Unassigned
            </label>
            <span className="ml-auto text-[#5B6472]">{filtered.length} requirements · {delivCount} deliverables · {missing} missing (conditional excluded)</span>
          </div>
          {pageCount > 1 && (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="rounded border border-[#E2E8F0] bg-white px-3 py-1.5 font-bold disabled:opacity-40">← Prev</button>
              <span className="text-[#5B6472]">Page {safePage + 1} of {pageCount} (50 per page)</span>
              <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} className="rounded border border-[#E2E8F0] bg-white px-3 py-1.5 font-bold disabled:opacity-40">Next →</button>
            </div>
          )}

          <div className="mb-4 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
            <div className="overflow-x-auto">
              <table className="matrix-table w-full min-w-[960px] text-[14.5px]" aria-label="Requirements matrix">
                <thead><tr>{["Section", "Requirement / Deliverables", "Owner", "Due", "Status", "QC", "Source"].map((h) => (<th key={h} className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">{h}</th>))}</tr></thead>
                <tbody>
                  {visible.map((r) => {
                    const items = delivs.filter((d) => d.requirement_id === r.id);
                    const isCollapsed = !!collapsed[r.id];
                    const e = editing[r.id];
                    return (
                      <>
                        <tr key={r.id} className="border-t-2 border-[#CBD5E1] bg-white">
                          <td className="px-3.5 py-3.5 align-top">
                            <Badge tone="blue">{r.section}</Badge>
                            <div className="mt-1"><Badge tone={(r.envelope ?? "Technical") === "Commercial" ? "amber" : "grey"}>{r.envelope ?? "Technical"}</Badge></div>
                          </td>
                          <td className="px-3.5 py-3.5 align-top">
                            <button onClick={() => setCollapsed((s) => ({ ...s, [r.id]: !s[r.id] }))} className="font-extrabold">
                              {isCollapsed ? "▸" : "▾"}{" "}
                              {r.ref && <span className="mr-1 rounded bg-[#0A2C4E] px-1.5 py-0.5 font-mono text-xs font-bold text-white">{r.ref}</span>}
                              {r.title}
                            </button>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge tone={r.kind === "condition" ? "purple" : r.kind === "commercial" ? "amber" : "grey"}>{r.kind}</Badge>
                              <Badge tone={toneForType(r.type)}>{r.type}</Badge>
                              <Badge tone={toneForRisk(r.risk)}>{r.risk}</Badge>
                              {r.edited && <Badge tone="amber">✎ hand-edited</Badge>}
                              {assessments[r.id] && (
                                <span title={assessments[r.id].detail || assessments[r.id].class}>
                                  <Badge tone={assessments[r.id].verdict === "drop" ? "red" : "green"}>
                                    AI: {assessments[r.id].verdict === "drop" ? `drop (${assessments[r.id].class})` : `keep (${assessments[r.id].class})`}
                                  </Badge>
                                </span>
                              )}
                            </div>
                            {r.description && r.description !== r.title && (
                              <div className="mt-1 whitespace-pre-wrap text-[13px] text-[#4B5563]">{r.description}</div>
                            )}
                            <div className="mt-1 text-[13px] text-[#4B5563]">{items.length > 0 ? `${items.length} collectable item${items.length === 1 ? "" : "s"}` : "no separate collectables — deliver as one"} · {r.risk_reason}</div>
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
                          <td className="px-3.5 py-3.5 align-top">
                            {r.owner ?? <span className="text-[#5B6472]">—</span>}
                            {r.suggested_owner && !r.owner ? (
                              <span className="block text-xs text-[#5B6472]">
                                suggested: <strong>{r.suggested_owner}</strong>{" "}
                                <button
                                  onClick={async () => {
                                    const res = await fetch(`/api/requirements/${r.id}/assign`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ owner: r.suggested_owner }),
                                    });
                                    if (res.ok) {
                                      const j = await res.json();
                                      setReqs((all) => all.map((x) => (x.id === r.id ? j.requirement : x)));
                                    }
                                  }}
                                  className="font-bold text-[#1D4C8D] underline"
                                >
                                  Accept
                                </button>
                              </span>
                            ) : null}
                          </td>
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

