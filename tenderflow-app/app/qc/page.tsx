"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";

interface Check {
  label: string;
  pass: boolean | null;
  detail: string;
}

interface QcRow {
  deliverable_id: string;
  requirement_id: string;
  title: string;
  owner: string | null;
  status: string;
  requirement_type: string | null;
  latest: {
    id: string;
    source_kind: string;
    source_label: string | null;
    verdict: string;
    effective: string;
    checks: Check[];
    action: string | null;
    engine: string;
    created_at: string;
    review?: { reviewer: string; verdict: string; note: string; created_at: string } | null;
  } | null;
}

function verdictTone(v: string) {
  return v === "compliant" ? "green" : v === "review" ? "amber" : v === "non_compliant" ? "red" : "grey";
}

function verdictIcon(v: string) {
  return v === "compliant" ? "●" : v === "review" ? "▲" : v === "non_compliant" ? "■" : "○";
}

export default function QcPage() {
  const [tenders, setTenders] = useState<{ id: string; title: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rows, setRows] = useState<QcRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [ovVerdict, setOvVerdict] = useState<Record<string, string>>({});
  const [ovNote, setOvNote] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const j = await fetch(`/api/tenders/${id}/qc`).then((r) => r.json());
    setRows(j.rows ?? []);
    setCounts(j.counts ?? {});
  }, []);

  useEffect(() => {
    fetch("/api/tenders")
      .then((r) => r.json())
      .then((j) => {
        setTenders(j.tenders ?? []);
        if (j.tenders?.length) {
          setActiveId(j.tenders[0].id);
          load(j.tenders[0].id);
        }
      })
      .catch(() => {});
  }, [load]);

  async function runOne(deliverable_id: string) {
    if (!activeId) return;
    setRunning(deliverable_id);
    setNotice(null);
    try {
      const r = await fetch(`/api/deliverables/${deliverable_id}/qc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tender_id: activeId }),
      });
      if (!r.ok) setNotice("QC run failed.");
      await load(activeId);
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    if (!activeId) return;
    setRunningAll(true);
    try {
      await fetch(`/api/tenders/${activeId}/qc`, { method: "POST" });
      await load(activeId);
    } finally {
      setRunningAll(false);
    }
  }

  async function override(qcId: string) {
    if (!activeId) return;
    const verdict = ovVerdict[qcId] ?? "review";
    const note = (ovNote[qcId] ?? "").trim();
    if (!note) {
      setNotice("An override needs a reason note — it is required.");
      return;
    }
    const r = await fetch(`/api/qc/${qcId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verdict, note, tender_id: activeId }),
    });
    if (r.ok) {
      setOvNote((s) => ({ ...s, [qcId]: "" }));
      setNotice(null);
      load(activeId);
    } else {
      setNotice("Override failed.");
    }
  }

  if (tenders.length === 0) {
    return (
      <Shell>
        <div className="mb-4 rounded-[10px] border border-[#E2E8F0] bg-white p-6 text-center text-sm">
          <strong>No tenders yet.</strong> Upload an ITT on the Overview page and run extraction first — QC checks evidence against extracted requirements.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold">Quality control</h1>
        <select value={activeId ?? ""} onChange={(e) => { setActiveId(e.target.value); load(e.target.value); }} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Select tender">
          {tenders.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
        </select>
        <button onClick={runAll} disabled={runningAll} className="rounded-lg bg-[#1D4C8D] px-4 py-2 text-sm font-bold text-white hover:bg-[#14365F] disabled:opacity-50">
          {runningAll ? "Running QC…" : "Run QC on all"}
        </button>
      </div>
      {notice && <p className="mb-3 text-sm font-bold text-[#DC2626]">{notice}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="green">● {counts.compliant ?? 0} compliant</Badge>
        <Badge tone="amber">▲ {counts.review ?? 0} review</Badge>
        <Badge tone="red">■ {counts.non_compliant ?? 0} non-compliant</Badge>
        <Badge tone="grey">○ {counts.not_reviewed ?? 0} not reviewed</Badge>
      </div>

      <ul className="grid gap-4">
        {rows.map((r) => {
          const v = r.latest;
          const eff = v?.effective ?? "not_reviewed";
          return (
            <li key={r.deliverable_id} className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
              <button onClick={() => setOpen((cur) => (cur === r.deliverable_id ? null : r.deliverable_id))} className="flex w-full flex-wrap items-center gap-2 p-3.5 text-left">
                <span className="font-bold">{open === r.deliverable_id ? "▾" : "▸"} {r.title}</span>
                <Badge tone={verdictTone(eff)}>{verdictIcon(eff)} {eff.replace("_", " ")}{v?.review ? " (overridden)" : ""}</Badge>
                <span className="text-xs text-[#5B6472]">{r.owner ?? "Unassigned"} · {v ? `${v.source_kind}: ${v.source_label}` : "no source yet"}</span>
              </button>
              {open === r.deliverable_id && (
                <div className="border-t border-[#E2E8F0] px-4 pb-3.5 pt-1.5">
                  {!v ? (
                    <div className="py-2 text-sm">
                      <p className="text-[#5B6472]">No QC run yet for this item.</p>
                      <button onClick={() => runOne(r.deliverable_id)} disabled={running === r.deliverable_id} className="mt-2 rounded bg-[#1D4C8D] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                        {running === r.deliverable_id ? "Running…" : "Run QC"}
                      </button>
                    </div>
                  ) : (
                    <>
                      {v.checks.map((c) => (
                        <div key={c.label} className="flex items-start gap-2 border-t border-dashed border-[#E2E8F0] py-[7px] text-sm">
                          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.pass === true ? "#16A34A" : c.pass === null ? "#D97706" : "#DC2626" }} />
                          <span><strong>{c.label}:</strong> {c.detail}</span>
                        </div>
                      ))}
                      <p className="py-2 text-sm font-semibold">{v.action}</p>
                      {v.review && (
                        <p className="rounded-lg border border-[#F2D3A0] bg-[#FDF1DE] p-2 text-xs">
                          <strong>Overridden by {v.review.reviewer}</strong> → {v.review.verdict}. Reason: {v.review.note}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button onClick={() => runOne(r.deliverable_id)} disabled={running === r.deliverable_id} className="rounded border border-[#E2E8F0] px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                          {running === r.deliverable_id ? "Running…" : "Re-run"}
                        </button>
                        <select value={ovVerdict[v.id] ?? "review"} onChange={(e) => setOvVerdict((s) => ({ ...s, [v.id]: e.target.value }))} className="rounded border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs" aria-label="Override verdict">
                          <option value="compliant">compliant</option>
                          <option value="review">review</option>
                          <option value="non_compliant">non_compliant</option>
                        </select>
                        <input value={ovNote[v.id] ?? ""} onChange={(e) => setOvNote((s) => ({ ...s, [v.id]: e.target.value }))} placeholder="Reason (required)…" className="min-w-[220px] flex-1 rounded border border-[#E2E8F0] px-2 py-1.5 text-xs" aria-label="Override reason" />
                        <button onClick={() => override(v.id)} className="rounded bg-[#1D4C8D] px-3 py-1.5 text-xs font-bold text-white">Override</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="py-3 text-xs text-[#5B6472]">Rules decide, humans resolve: uncertain evidence returns Review, never a false Compliant. Overrides always require a reason.</p>
    </Shell>
  );
}
