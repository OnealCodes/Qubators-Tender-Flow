"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";

interface OverviewField {
  value: string | null;
  page: number | null;
}

interface TenderSummary {
  id: string;
  client: string | null;
  title: string;
  reference: string | null;
  submission_deadline: string | null;
  file_name: string;
  file_size: number;
  page_count: number;
  scanned: boolean;
  status: string;
  created_at: string;
  bucket_counts?: Record<string, number>;
}

interface TenderDetail extends TenderSummary {
  scope: string | null;
  clarification_deadline: string | null;
  clarification_meeting: string | null;
  submission_format: string | null;
  instructions: string | null;
  overview?: {
    client: OverviewField;
    title: OverviewField;
    reference: OverviewField;
    scope: OverviewField;
    submission_deadline: OverviewField;
    clarification_deadline: OverviewField;
    clarification_meeting: OverviewField;
    submission_format: OverviewField;
    instructions: OverviewField;
  };
  pages?: { page_no: number; text: string; char_count: number }[];
}

function fmtSize(n: number): string {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function OverviewPage() {
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [backend, setBackend] = useState<string>("local");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenderDetail | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [drawerPage, setDrawerPage] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/tenders");
      const j = await r.json();
      setTenders(j.tenders ?? []);
      setBackend(j.backend ?? "local");
      if (!activeId && j.tenders?.length) setActiveId(j.tenders[0].id);
    } catch {
      setError("Could not reach the intake API. Is the dev server running?");
    }
  }, [activeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/tenders/${activeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setDetail(j.tender))
      .catch(() => {});
  }, [activeId]);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    setProgress(`Uploading ${file.name} (${fmtSize(file.size)})…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      setProgress(`Parsing ${file.name} — extracting pages…`);
      const r = await fetch("/api/tenders", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Upload failed.");
      } else {
        setProgress(j.deduped ? "Already uploaded before — opened the existing tender." : j.scanned ? "Done — scanned PDF flagged (no extractable text)." : `Done — ${j.tender.page_count} pages parsed.`);
        setActiveId(j.tender.id);
        await refresh();
        const d = await fetch(`/api/tenders/${j.tender.id}`).then((x) => x.json());
        setDetail(d.tender);
      }
    } catch {
      setError("Upload failed — network error.");
    } finally {
      setUploading(false);
    }
  }

  const drawerText = drawerPage != null ? detail?.pages?.find((p) => p.page_no === drawerPage)?.text : null;

  function SourceBadge({ page, label }: { page: number | null; label: string }) {
    if (page == null) return <span className="text-xs text-[#5B6472]">no source yet</span>;
    return (
      <button onClick={() => setDrawerPage(page)} title={`Show page ${page} text`} className="whitespace-nowrap rounded-md border border-[#E2E8F0] bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-xs hover:border-[#F5B301] hover:bg-[#FFF6DE]">
        {label} · p.{page} →
      </button>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-extrabold">Tender intake + overview</h1>
      <p className="mb-4 mt-1 text-[13px] text-[#5B6472]">Upload an ITT package (PDF, max 200 MB). Originals stay in <code className="rounded border border-[#E2E8F0] bg-white px-1 font-mono text-xs">uploads/</code>; parsed pages + overview are stored {backend === "postgres" ? "in local PostgreSQL" : "locally (Postgres starts with Docker at the database setup phase)"}.</p>

      <Panel title="Upload ITT package" right={<Badge tone={backend === "postgres" ? "green" : "grey"}>{backend === "postgres" ? "● Postgres" : "○ Local store"}</Badge>}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm ${dragOver ? "border-[#F5B301] bg-[#FFF6DE]" : "border-[#E2E8F0] bg-[#F9FAFB]"}`}
        >
          <div className="font-bold">Drag &amp; drop a tender PDF here, or click to choose</div>
          <div className="mt-1 text-[#5B6472]">PDF only · 200 MB max · scanned PDFs are flagged, never invented</div>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </div>
        {uploading && <p className="py-2 text-sm font-semibold">{progress}</p>}
        {!uploading && progress && <p className="py-2 text-sm text-[#5B6472]">{progress}</p>}
        {!uploading && progress.startsWith("Done") && (
          <div className="mt-1 rounded-lg border border-[#F5B301] bg-[#FFF6DE] p-3 text-sm">
            <strong>Next step:</strong> go to the{" "}
            <Link href="/workspace" className="font-bold text-[#1D4C8D] underline">Matrix → Run extraction</Link>,
            then Assignments → QC → Checklist. Each step picks up where this one left off.
          </div>
        )}
        {error && <p className="py-2 text-sm font-bold text-[#DC2626]">{error}</p>}
      </Panel>

      <Panel title={`Uploaded tenders (${tenders.length})`}>
        {tenders.length === 0 ? (
          <p className="py-3 text-sm text-[#5B6472]">No tenders uploaded yet — the workspace below still shows demonstration data until you upload.</p>
        ) : (
          <ul className="divide-y divide-[#E2E8F0]">
            {tenders.map((t) => (
              <li key={t.id}>
                <button onClick={() => setActiveId(t.id)} className={`flex w-full flex-wrap items-center gap-2 py-2.5 text-left text-sm ${activeId === t.id ? "font-bold" : ""}`}>
                  <span className="font-bold">{t.title}</span>
                  <span className="text-[#5B6472]">{t.file_name} · {fmtSize(t.file_size)} · {t.page_count} pages</span>
                  {t.scanned && <Badge tone="amber">▲ Scanned</Badge>}
                  {t.submission_deadline && <Badge tone="blue">{t.submission_deadline}</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {detail && (
        <Panel title={`Overview — ${detail.title}`} right={<Badge tone="green">● Parsed</Badge>}>
          <dl className="grid gap-3 py-2 text-sm md:grid-cols-2">
            {([
              ["Client", detail.client, 1],
              ["Reference", detail.reference, 1],
              ["Submission deadline", detail.submission_deadline, 1],
              ["Clarification deadline", detail.clarification_deadline, 1],
              ["Clarification meeting", detail.clarification_meeting, 1],
              ["Submission format", detail.submission_format, 1],
            ] as [string, string | null, number][]).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] p-3">
                <dt className="text-xs font-bold uppercase tracking-wider text-[#5B6472]">{k}</dt>
                <dd className="mt-1 font-semibold">{v ?? <span className="font-normal text-[#5B6472]">not found in document</span>}</dd>
              </div>
            ))}
          </dl>
          {detail.scope && <p className="py-1 text-sm"><strong>Scope:</strong> {detail.scope}</p>}
          {detail.bucket_counts && (
            <div className="flex flex-wrap gap-2 py-2">
              {Object.entries(detail.bucket_counts).map(([b, n]) => (<span key={b}><Badge tone="blue">{b}: {n} hits</Badge></span>))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="font-bold">Sources:</span>
            {(detail.pages ?? []).slice(0, 6).map((p) => (
              <SourceBadge key={p.page_no} page={p.page_no} label={`p.${p.page_no} (${p.char_count} chars)`} />
            ))}
            <span className="text-xs text-[#5B6472]">click a source to preview the extracted page text</span>
          </div>
        </Panel>
      )}

      {drawerPage != null && (
        <div className="fixed inset-y-0 right-0 z-20 w-full max-w-md overflow-y-auto border-l border-[#E2E8F0] bg-white p-5 shadow-xl" role="dialog" aria-label={`Source page ${drawerPage}`}>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold">Source — page {drawerPage}</h3>
            <button onClick={() => setDrawerPage(null)} className="ml-auto rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-bold">Close</button>
          </div>
          <p className="mt-1 text-xs text-[#5B6472]">Extracted text for {detail?.file_name}. This is what the overview fields cite — verify before trusting.</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{drawerText || "(empty page)"}</p>
        </div>
      )}
    </Shell>
  );
}
