"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";

interface Group {
  group: string;
  state: string;
  detail: string;
}

interface Folder {
  folder: string;
  files: { name: string; from: string }[];
}

export default function ChecklistPage() {
  const [tenders, setTenders] = useState<{ id: string; title: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [percent, setPercent] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [critical, setCritical] = useState<{ title: string; owner: string | null; verdict: string }[]>([]);
  const [conditional, setConditional] = useState<{ title: string }[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [ready, setReady] = useState(false);
  const [submission, setSubmission] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  const load = useCallback(async (id: string) => {
    const [r, c] = await Promise.all([
      fetch(`/api/tenders/${id}/readiness`).then((x) => x.json()),
      fetch(`/api/tenders/${id}/compilation`).then((x) => x.json()),
    ]);
    setPercent(r.readiness?.percent ?? 0);
    setCounts(r.readiness?.counts ?? {});
    setCritical(r.readiness?.critical_outstanding ?? []);
    setConditional(r.readiness?.conditional_open ?? []);
    setGroups(r.final?.groups ?? []);
    setReady(!!r.final?.ready);
    setSubmission(r.submission_deadline ?? null);
    setFolders(c.folders ?? []);
    setMissing(c.missing ?? []);
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

  function exportSummary() {
    const lines = [
      `# Final bid review — ${tenders.find((t) => t.id === activeId)?.title ?? ""}`,
      `Submission: ${submission ?? "unknown"} · Readiness: ${percent}%`,
      `Counts: compliant ${counts.compliant ?? 0}, review ${counts.review ?? 0}, non-compliant ${counts.non_compliant ?? 0}, not reviewed ${counts.not_reviewed ?? 0}`,
      "",
      ...groups.map((g) => `## ${g.group} [${g.state}] — ${g.detail}`),
      "",
      `Critical outstanding: ${critical.length ? critical.map((c) => c.title).join("; ") : "none"}`,
      `Conditional open: ${conditional.length ? conditional.map((c) => c.title).join("; ") : "none"}`,
      `Missing from compilation: ${missing.length ? missing.join("; ") : "none"}`,
      "",
      ready ? "READY FOR FINAL HUMAN REVIEW" : "NOT READY — resolve blocked items above. The app never auto-submits.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "final-bid-review.md";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (tenders.length === 0) {
    return (
      <Shell>
        <div className="mb-4 rounded-[10px] border border-[#E2E8F0] bg-white p-6 text-center text-sm">
          <strong>No tenders yet.</strong> Upload, extract and collect evidence first — readiness is computed from real verdicts, never guessed.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold">Submission readiness</h1>
        <select value={activeId ?? ""} onChange={(e) => { setActiveId(e.target.value); load(e.target.value); }} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Select tender">
          {tenders.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
        </select>
        <button onClick={exportSummary} className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-bold text-[#0A2C4E]">Export summary</button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-[10px] border border-[#E2E8F0] bg-white p-3.5">
          <div className="text-xs font-bold uppercase tracking-wider text-[#5B6472]">Overall</div>
          <div className="my-1 text-[26px] font-extrabold">{percent}%</div>
          <div className="text-[13px] text-[#5B6472]">weighted · conditional excluded</div>
        </div>
        <div className="rounded-[10px] border border-[#E2E8F0] bg-white p-3.5">
          <div className="text-xs font-bold uppercase tracking-wider text-[#5B6472]">Verdicts</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="green">● {counts.compliant ?? 0}</Badge>
            <Badge tone="amber">▲ {counts.review ?? 0}</Badge>
            <Badge tone="red">■ {counts.non_compliant ?? 0}</Badge>
            <Badge tone="grey">○ {counts.not_reviewed ?? 0}</Badge>
          </div>
        </div>
        <div className="rounded-[10px] border border-[#E2E8F0] bg-white p-3.5">
          <div className="text-xs font-bold uppercase tracking-wider text-[#5B6472]">Critical outstanding</div>
          <div className="my-1 text-[26px] font-extrabold" style={{ color: critical.length ? "#DC2626" : "#16A34A" }}>{critical.length}</div>
          <div className="text-[13px] text-[#5B6472]">{conditional.length} conditional open (not counted)</div>
        </div>
        <div className="rounded-[10px] border border-[#E2E8F0] bg-white p-3.5">
          <div className="text-xs font-bold uppercase tracking-wider text-[#5B6472]">Submission</div>
          <div className="my-1 text-lg font-extrabold">{submission ?? "unknown"}</div>
          <div className={`text-[13px] font-bold ${ready ? "text-[#16A34A]" : "text-[#D97706]"}`}>{ready ? "READY FOR FINAL HUMAN REVIEW" : "Not ready yet"}</div>
        </div>
      </div>

      {critical.length > 0 && (
        <Panel title={`Critical outstanding (${critical.length})`}>
          <ul className="divide-y divide-[#E2E8F0]">
            {critical.map((c) => (
              <li key={c.title} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Badge tone="red">■ Critical</Badge>
                <span className="font-semibold">{c.title}</span>
                <span className="text-[#5B6472]">{c.owner ?? "Unassigned"} · {c.verdict.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Final compliance review">
        <ul className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <li key={g.group} className="rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge tone={g.state === "pass" ? "green" : g.state === "attention" ? "amber" : "red"}>
                  {g.state === "pass" ? "●" : g.state === "attention" ? "▲" : "■"} {g.group}
                </Badge>
              </div>
              <div className="mt-1 text-[#4B5563]">{g.detail}</div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={`Bid compilation (${missing.length} missing)`} right={<Badge tone={missing.length ? "amber" : "green"}>{missing.length ? "▲ Incomplete" : "● Complete"}</Badge>}>
        <div className="grid gap-3 md:grid-cols-2">
          {folders.map((f) => (
            <div key={f.folder} className="rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] p-3 text-sm">
              <div className="font-bold">{f.folder}</div>
              <ul className="mt-1">
                {f.files.map((file, i) => (
                  <li key={i} className={file.from === "outstanding" ? "font-bold text-[#DC2626]" : ""}>
                    {file.from === "outstanding" ? `■ ${file.name}` : `● ${file.name}`}
                  </li>
                ))}
                {f.files.length === 0 && <li className="text-[#5B6472]">(empty)</li>}
              </ul>
            </div>
          ))}
        </div>
        <p className="py-2 text-xs text-[#5B6472]">Files copied under <span className="font-mono">uploads/&lt;tender&gt;/compilation/</span> with a manifest — verify placement against the client structure before submitting.</p>
      </Panel>
    </Shell>
  );
}
