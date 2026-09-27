"use client";

import { useState } from "react";
import { matrix, qcChecks, readiness, singleRows, tender } from "../lib/demo-data";

const toneBg: Record<string, string> = {
  green: "bg-[#E7F6EC] text-[#0F6B2E] border-[#B9E3C4]",
  amber: "bg-[#FDF1DE] text-[#8A4B00] border-[#F2D3A0]",
  red: "bg-[#FDECEC] text-[#9B1C1C] border-[#F3B8B8]",
  grey: "bg-[#EEF1F4] text-[#4B5563] border-[#D3D8DE]",
  purple: "bg-[#EFE7FD] text-[#5B21B6] border-[#D3C2F8]",
  blue: "bg-[#E6EEFD] text-[#1D4ED8] border-[#B9CCF5]",
};

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`badge border ${toneBg[tone] ?? toneBg.grey}`}>{children}</span>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState("Matrix");
  const q = query.toLowerCase();

  const tabs = ["Matrix", "Overview", "Documents", "Assignments", "QC", "Checklist", "Activity"];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col gap-4 bg-[#0A2C4E] p-4 text-slate-200 md:flex" aria-label="Primary">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5B301] text-lg font-extrabold text-[#0A2C4E]">T</div>
          <div>
            <div className="text-lg font-extrabold text-white">Tender<span className="text-[#F5B301]">Flow</span></div>
            <div className="text-xs text-slate-300">Tender Workspace</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {["Tenders", "Library", "Expiry", "Team", "Settings"].map((item, i) => (
            <button key={item} className={`rounded-lg px-3 py-2.5 text-left text-sm ${i === 0 ? "bg-[#12385F] text-white shadow-[inset_3px_0_0_#F5B301]" : "text-slate-300 hover:bg-[#12385F] hover:text-white"}`}>
              {item}
            </button>
          ))}
        </nav>
        <div className="rounded-[10px] border border-white/15 bg-white/5 p-3">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">Colour palette</h4>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-white">
            {[["#0A2C4E", "Navy"], ["#F5B301", "Gold"], ["#1D4C8D", "Primary Blue"], ["#16A34A", "Compliant"], ["#D97706", "Review"], ["#DC2626", "Risk"]].map(([hex, name]) => (
              <div key={name} className="rounded-lg p-2" style={{ background: hex, color: name === "Gold" ? "#0A2C4E" : "#fff" }}>{name}<span className="block font-mono text-[10px] opacity-90">{hex}</span></div>
            ))}
          </div>
        </div>
        <div className="rounded-[10px] border border-white/15 bg-white/5 p-3 text-[13px]">
          <span className="rounded bg-[#F5B301] px-1.5 py-0.5 text-[11px] font-bold text-[#0A2C4E]">PHASE 0</span>
          <p className="mt-2 text-slate-300">App shell + demo data. No database yet.</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#E2E8F0] bg-white px-5 py-3">
          <div className="flex max-w-[460px] flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search requirements, documents, owners…" aria-label="Search requirements" className="flex-1 border-0 text-sm outline-none" />
          </div>
          <button className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-bold text-[#0A2C4E]" type="button">Final review</button>
          <button className="rounded-lg bg-[#1D4C8D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#14365F]" type="button">+ Upload tender</button>
          <div className="ml-auto hidden text-[13px] text-[#5B6472] lg:block">Submission in <strong className="text-[#DC2626]">{tender.countdown}</strong> · {tender.submission}</div>
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#0A2C4E] text-[13px] font-bold text-white" title="Bid Manager">BM</div>
        </div>

        <div className="mx-auto w-full max-w-[1240px] px-5 py-5">
          <div className="mb-4 rounded-[10px] border border-[#F0D489] bg-[#FFF8E6] px-3.5 py-2.5 text-[13px] text-[#6B4E00]">
            <strong>Phase 0 shell — demonstration data only.</strong> Layout mirrors <span className="font-mono">design.html</span>. No backend, database, or AI is wired up yet.
          </div>

          <div className="hero-band mb-4 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2.5 text-xs font-extrabold uppercase tracking-[0.1em] text-[#FFE08A]">
              <span className="inline-block h-1 w-[34px] rounded bg-[#F5B301]" /> Oil &amp; Gas · Tender Workspace
            </div>
            <h1 className="mt-2 text-2xl font-extrabold">{tender.client} — {tender.title}</h1>
            <div className="mt-1.5 text-[13px] text-[#C9D6E5]">Client: <strong className="text-white">{tender.client}</strong> · Ref: <code className="rounded-md border border-white/25 bg-white/10 px-1.5 py-px font-mono text-xs text-white">{tender.ref}</code> · Clarification: {tender.clarification} · Format: {tender.format}</div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {readiness.map((c) => (
              <div key={c.label} className="rounded-[10px] border border-[#E2E8F0] bg-white p-3.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[#5B6472]">{c.label}</div>
                <div className="my-1 text-[26px] font-extrabold">{c.value}</div>
                <div className="text-[13px] text-[#5B6472]">{c.sub}</div>
              </div>
            ))}
          </div>

          <div className="mb-3.5 flex flex-wrap gap-1.5 border-b border-[#E2E8F0]" role="tablist" aria-label="Workspace">
            {tabs.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`border-b-[3px] px-3 py-2.5 text-sm font-semibold ${tab === t ? "border-[#F5B301] text-[#0A2C4E]" : "border-transparent text-[#5B6472]"}`}>{t}</button>
            ))}
          </div>

          <div className="mb-4 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
            <div className="flex flex-wrap items-center gap-2.5 border-b border-[#E2E8F0] p-3.5">
              <h2 className="text-base font-bold">Responsibility matrix</h2>
              <span className="text-[13px] text-[#5B6472]">Parent → deliverables. Click a parent to expand. Search filters rows.</span>
              <span className="ml-auto flex gap-2"><Badge tone="red">● Critical 4</Badge><Badge tone="blue">● Mandatory 11</Badge><Badge tone="purple">● Conditional 2</Badge></span>
            </div>
            <div className="overflow-x-auto">
              <table className="matrix-table w-full min-w-[960px] text-[14.5px]" aria-label="Requirements matrix">
                <thead><tr><th className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">Section</th><th className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">Requirement / Deliverables</th><th className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">Owner</th><th className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">Due</th><th className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">Status</th><th className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">QC</th><th className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">Source</th></tr></thead>
                <tbody>
                  {matrix.filter((g) => !q || JSON.stringify(g).toLowerCase().includes(q)).map((g) => (
                    <>
                      <tr key={g.id} onClick={() => setCollapsed((s) => ({ ...s, [g.id]: !s[g.id] }))} className="cursor-pointer border-t-2 border-[#CBD5E1] bg-white hover:bg-[#FFF6DE]">
                        <td className="px-3.5 py-3.5 align-top"><Badge tone={g.sectionTone}>{g.section}</Badge></td>
                        <td className="px-3.5 py-3.5 align-top"><div className="text-[14.5px] font-extrabold">{collapsed[g.id] ? "▸" : "▾"} {g.title}</div><div className="text-[13px] text-[#4B5563]">{g.subtitle}</div></td>
                        <td className="px-3.5 py-3.5 align-top">{g.owner}</td>
                        <td className="px-3.5 py-3.5 align-top">{g.due}</td>
                        <td className="px-3.5 py-3.5 align-top"><Badge tone={g.statusTone}>{g.status}</Badge></td>
                        <td className="px-3.5 py-3.5 align-top"><Badge tone={g.qcTone}>{g.qc}</Badge></td>
                        <td className="px-3.5 py-3.5 align-top"><span className="whitespace-nowrap rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-xs">{g.source}</span></td>
                      </tr>
                      {!collapsed[g.id] && g.items.filter((i) => !q || JSON.stringify(i).toLowerCase().includes(q)).map((i) => (
                        <tr key={g.id + i.title} className="border-t border-[#E2E8F0] bg-[#F4F6F8]">
                          <td className="px-3.5 py-3.5"></td>
                          <td className="px-3.5 py-3.5">{i.title} <span className="text-[13px] text-[#4B5563]">{i.detail}</span></td>
                          <td className="px-3.5 py-3.5">{i.owner}</td>
                          <td className="px-3.5 py-3.5">{i.due}</td>
                          <td className="px-3.5 py-3.5"><Badge tone={i.statusTone}>{i.status}</Badge></td>
                          <td className="px-3.5 py-3.5"><Badge tone={i.qcTone}>{i.qc}</Badge></td>
                          <td className="px-3.5 py-3.5"><span className="whitespace-nowrap rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-xs">{i.source}</span></td>
                        </tr>
                      ))}
                    </>
                  ))}
                  {singleRows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q)).map((r) => (
                    <tr key={r.title} className="border-t border-[#E2E8F0] bg-white">
                      <td className="px-3.5 py-3.5"><Badge tone={r.tone}>{r.section}</Badge></td>
                      <td className="px-3.5 py-3.5"><div className="font-extrabold">{r.title}</div><div className="text-[13px] text-[#4B5563]">{r.sub}</div></td>
                      <td className="px-3.5 py-3.5">{r.owner}</td>
                      <td className="px-3.5 py-3.5">{r.due}</td>
                      <td className="px-3.5 py-3.5"><Badge tone={r.status.includes("Received") ? "green" : r.status.includes("progress") ? "amber" : "grey"}>{r.status}</Badge></td>
                      <td className="px-3.5 py-3.5"><Badge tone={r.qc.includes("compliant") ? "green" : r.qc.includes("Review") ? "amber" : "grey"}>{r.qc}</Badge></td>
                      <td className="px-3.5 py-3.5"><span className="whitespace-nowrap rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-xs">{r.source}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-[10px] border border-[#E2E8F0] bg-white">
              <div className="flex items-center gap-2.5 border-b border-[#E2E8F0] p-3.5"><h2 className="text-base font-bold">QC example — Audited Accounts.pdf</h2><Badge tone="red">■ Potential non-compliance</Badge></div>
              <div className="px-4 pb-3.5 pt-1.5">
                {qcChecks.map((c) => (
                  <div key={c.text} className="flex items-start gap-2 border-t border-dashed border-[#E2E8F0] py-[7px] text-sm">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.pass ? "#16A34A" : "#DC2626" }} />
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[10px] border border-[#E2E8F0] bg-white">
              <div className="border-b border-[#E2E8F0] p-3.5"><h2 className="text-base font-bold">Assignments + activity (DEMO)</h2></div>
              <div className="px-4 pb-3.5 pt-1.5 text-sm">
                <div><strong>Oluchi — 8 items:</strong> Insurance (Pending) · Parent Guarantee (In progress) · Community Plan (Received)</div>
                <div className="mt-2 text-[#5B6472]">Reminder: 3 requirements due tomorrow. Oluchi has 2 overdue.</div>
                <div className="mt-2"><span className="font-mono text-xs">09:15</span> Library match: NUPRC Certificate 2026 — High confidence</div>
                <div className="mt-1.5"><span className="font-mono text-xs">11:02</span> Finance uploaded Audited Accounts.pdf — QC flagged 2024 missing</div>
              </div>
            </div>
          </div>
          <p className="mb-8 mt-3.5 text-xs text-[#5B6472]">Sample Chevron-like data for illustration only. Matching suggests documents; it never approves compliance. Final submission always needs human review.</p>
        </div>
      </div>
    </div>
  );
}
