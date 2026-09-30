"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { tender } from "../lib/demo-data";
import { emitSearch } from "./ui";

const tabs = [
  { label: "Matrix", href: "/workspace" },
  { label: "Overview", href: "/overview" },
  { label: "Documents", href: "/documents" },
  { label: "Assignments", href: "/assignments" },
  { label: "QC", href: "/qc" },
  { label: "Checklist", href: "/checklist" },
  { label: "Activity", href: "/activity" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[248px] shrink-0 flex-col gap-4 bg-[#0A2C4E] p-4 text-slate-200 md:flex" aria-label="Primary">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2" aria-label="TenderFlow home">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5B301] text-lg font-extrabold text-[#0A2C4E]">T</div>
            <div>
              <div className="text-lg font-extrabold text-white">Tender<span className="text-[#F5B301]">Flow</span></div>
              <div className="text-xs text-slate-300">Tender Workspace</div>
            </div>
          </Link>
        </div>
        <nav className="flex flex-col gap-1">
          <Link href="/tenders" className={`rounded-lg px-3 py-2.5 text-left text-sm ${pathname === "/tenders" ? "bg-[#12385F] text-white shadow-[inset_3px_0_0_#F5B301]" : "text-slate-300 hover:bg-[#12385F] hover:text-white"}`}>
            Tenders
          </Link>
          {["Library", "Expiry", "Team", "Settings"].map((item) => (
            <button key={item} className="rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-[#12385F] hover:text-white">
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#E2E8F0] bg-white px-5 py-3">
          <div className="flex max-w-[460px] flex-1 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">
            <span aria-hidden="true">⌕</span>
            <input value={q} onChange={(e) => { setQ(e.target.value); emitSearch(e.target.value); }} type="search" placeholder="Search requirements, documents, owners…" aria-label="Search requirements" className="flex-1 border-0 text-sm outline-none" />
          </div>
          <Link href="/checklist" className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-bold text-[#0A2C4E]">Final review</Link>
          <Link href="/upload" className="rounded-lg bg-[#1D4C8D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#14365F]" title="Upload a new ITT package">+ Upload tender</Link>
          <div className="ml-auto hidden text-[13px] text-[#5B6472] lg:block">Submission in <strong className="text-[#DC2626]">{tender.countdown}</strong> · {tender.submission}</div>
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#0A2C4E] text-[13px] font-bold text-white" title="Bid Manager">BM</div>
        </div>

        <div className="mx-auto w-full max-w-[1240px] px-5 py-5">
          <div className="mb-4 rounded-[10px] border border-[#F0D489] bg-[#FFF8E6] px-3.5 py-2.5 text-[13px] text-[#6B4E00]">
            <strong>Tender workspace — local pilot.</strong> AI suggests; you decide. Matching suggests documents; it never approves compliance.
          </div>
          <div className="mb-3.5 flex flex-wrap gap-1.5 border-b border-[#E2E8F0]" role="tablist" aria-label="Workspace">
            {tabs.map((t) => {
              const active = pathname === t.href;
              return (
                <Link key={t.label} href={t.href} role="tab" aria-selected={active} className={`border-b-[3px] px-3 py-2.5 text-sm font-semibold ${active ? "border-[#F5B301] text-[#0A2C4E]" : "border-transparent text-[#5B6472]"}`}>
                  {t.label}
                </Link>
              );
            })}
          </div>
          {children}
          <p className="mb-8 mt-3.5 text-xs text-[#5B6472]">Sample Chevron-like data for illustration only. Matching suggests documents; it never approves compliance. Final submission always needs human review.</p>
        </div>
      </div>
    </div>
  );
}
