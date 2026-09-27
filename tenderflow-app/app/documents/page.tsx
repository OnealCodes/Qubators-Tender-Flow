"use client";

import { useEffect, useState } from "react";
import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";
import { libraryDocs } from "../../lib/demo-data";

export default function DocumentsPage() {
  const [q, setQ] = useState("");
  useEffect(() => {
    const h = (e: Event) => setQ(((e as CustomEvent<string>).detail ?? "").toLowerCase());
    window.addEventListener("tf-search", h);
    return () => window.removeEventListener("tf-search", h);
  }, []);
  const rows = libraryDocs.filter((d) => !q || `${d.name} ${d.type}`.toLowerCase().includes(q));

  return (
    <Shell>
      <h1 className="mb-4 text-2xl font-extrabold">Company document library <span className="text-sm font-semibold text-[#5B6472]">(DEMO)</span></h1>
      <Panel title="Reusable documents">
        <div className="overflow-x-auto">
          <table className="matrix-table w-full min-w-[720px] text-sm" aria-label="Document library">
            <thead><tr>{["Document", "Type", "Version", "Expiry", "Status"].map((h) => (<th key={h} className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">{h}</th>))}</tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.name} className="border-t border-[#E2E8F0] bg-white">
                  <td className="px-3.5 py-3.5 font-bold">{d.name}</td>
                  <td className="px-3.5 py-3.5">{d.type}</td>
                  <td className="px-3.5 py-3.5 font-mono text-xs">{d.version}</td>
                  <td className="px-3.5 py-3.5">{d.expiry}</td>
                  <td className="px-3.5 py-3.5"><Badge tone={d.tone}>{d.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="py-2 text-[13px] text-[#5B6472]">Matching suggests relevant documents with confidence + expiry badge. Matching never auto-approves compliance — a human accepts or rejects.</p>
      </Panel>
    </Shell>
  );
}

