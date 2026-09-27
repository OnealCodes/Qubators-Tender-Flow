"use client";

import { useEffect, useState } from "react";
import Shell from "../components/shell";
import { Badge } from "../components/ui";
import { matrix, readiness, singleRows, tender } from "../lib/demo-data";

export default function MatrixPage() {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const h = (e: Event) => setQuery((e as CustomEvent<string>).detail ?? "");
    window.addEventListener("tf-search", h);
    return () => window.removeEventListener("tf-search", h);
  }, []);
  const q = query.toLowerCase();

  return (
    <Shell>
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

      <div className="mb-4 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#E2E8F0] p-3.5">
          <h2 className="text-base font-bold">Responsibility matrix</h2>
          <span className="text-[13px] text-[#5B6472]">Parent → deliverables. Click a parent to expand. Search filters rows.</span>
          <span className="ml-auto flex gap-2"><Badge tone="red">● Critical 4</Badge><Badge tone="blue">● Mandatory 11</Badge><Badge tone="purple">● Conditional 2</Badge></span>
        </div>
        <div className="overflow-x-auto">
          <table className="matrix-table w-full min-w-[960px] text-[14.5px]" aria-label="Requirements matrix">
            <thead><tr>{["Section", "Requirement / Deliverables", "Owner", "Due", "Status", "QC", "Source"].map((h) => (<th key={h} className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {matrix.filter((g) => !q || JSON.stringify(g).toLowerCase().includes(q)).map((g) => (
                <MatrixGroup key={g.id} g={g} q={q} collapsed={!!collapsed[g.id]} toggle={() => setCollapsed((s) => ({ ...s, [g.id]: !s[g.id] }))} />
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
    </Shell>
  );
}

function MatrixGroup({ g, q, collapsed, toggle }: { g: (typeof matrix)[number]; q: string; collapsed: boolean; toggle: () => void }) {
  return (
    <>
      <tr onClick={toggle} className="cursor-pointer border-t-2 border-[#CBD5E1] bg-white hover:bg-[#FFF6DE]">
        <td className="px-3.5 py-3.5 align-top"><Badge tone={g.sectionTone}>{g.section}</Badge></td>
        <td className="px-3.5 py-3.5 align-top"><div className="text-[14.5px] font-extrabold">{collapsed ? "▸" : "▾"} {g.title}</div><div className="text-[13px] text-[#4B5563]">{g.subtitle}</div></td>
        <td className="px-3.5 py-3.5 align-top">{g.owner}</td>
        <td className="px-3.5 py-3.5 align-top">{g.due}</td>
        <td className="px-3.5 py-3.5 align-top"><Badge tone={g.statusTone}>{g.status}</Badge></td>
        <td className="px-3.5 py-3.5 align-top"><Badge tone={g.qcTone}>{g.qc}</Badge></td>
        <td className="px-3.5 py-3.5 align-top"><span className="whitespace-nowrap rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-xs">{g.source}</span></td>
      </tr>
      {!collapsed && g.items.filter((i) => !q || JSON.stringify(i).toLowerCase().includes(q)).map((i) => (
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
  );
}
