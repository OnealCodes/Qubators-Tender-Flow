"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

function fmtSize(n: number): string {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tender, setTender] = useState<{ id: string; title: string; page_count: number; scanned: boolean } | null>(null);
  const [extracted, setExtracted] = useState<{ requirement_count: number; deliverable_count: number } | null>(null);

  async function upload(file: File) {
    setError(null);
    setTender(null);
    setExtracted(null);
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
        setTender({ id: j.tender.id, title: j.tender.title, page_count: j.tender.page_count, scanned: j.scanned });
        setProgress(
          j.scanned
            ? "Done — scanned PDF flagged (no extractable text). Try a text-based PDF."
            : `Done — ${j.tender.page_count} pages parsed. Ready to extract requirements.`
        );
      }
    } catch {
      setError("Upload failed — network error.");
    } finally {
      setUploading(false);
    }
  }

  async function startExtraction() {
    if (!tender) return;
    setError(null);
    setExtracting(true);
    try {
      const r = await fetch(`/api/tenders/${tender.id}/extract`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Extraction failed.");
      } else {
        setExtracted({ requirement_count: j.diff.requirement_count, deliverable_count: j.diff.deliverable_count });
        router.push("/workspace");
      }
    } catch {
      setError("Extraction failed — network error.");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#111827]">
      <header className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5B301] text-lg font-extrabold text-[#0A2C4E]">T</div>
            <div className="text-lg font-extrabold text-[#0A2C4E]">
              Tender<span className="text-[#F5B301]">Flow</span>
            </div>
          </Link>
          <span className="ml-auto text-sm text-[#5B6472]">Step 1 of 3 — Upload</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-3xl font-extrabold text-[#0A2C4E]">Upload your tender</h1>
        <p className="mt-2 text-[#5B6472]">
          Drop in the ITT package as PDF (up to 200 MB). TenderFlow parses every page, then builds
          your numbered responsibility matrix — exact tender wording, source page on every row.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center ${
            dragOver ? "border-[#F5B301] bg-[#FFF6DE]" : "border-[#E2E8F0] bg-white"
          }`}
        >
          <div className="text-lg font-bold">Drag &amp; drop your tender PDF here</div>
          <div className="mt-1 text-sm text-[#5B6472]">or click to browse — scanned PDFs are flagged, never invented</div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </div>

        {uploading && <p className="mt-3 text-sm font-semibold">{progress}</p>}
        {!uploading && progress && <p className="mt-3 text-sm text-[#5B6472]">{progress}</p>}
        {error && <p className="mt-3 text-sm font-bold text-[#DC2626]">{error}</p>}

        {tender && !tender.scanned && (
          <div className="mt-4 rounded-[10px] border border-[#E2E8F0] bg-white p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-[#5B6472]">Parsed tender</div>
            <div className="mt-1 text-lg font-extrabold">{tender.title}</div>
            <div className="text-sm text-[#5B6472]">{tender.page_count} pages · originals kept locally</div>
            <button
              onClick={startExtraction}
              disabled={extracting}
              className="mt-4 rounded-lg bg-[#F5B301] px-6 py-3 text-sm font-extrabold text-[#0A2C4E] hover:bg-[#FFC81A] disabled:opacity-50"
            >
              {extracting ? "Extracting requirements…" : extracted ? "Open the matrix →" : "Start requirement extraction"}
            </button>
            {extracted && (
              <p className="mt-2 text-sm text-[#5B6472]">
                {extracted.requirement_count} requirements ready — taking you to the workspace…
              </p>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-[#5B6472]">
          Prefer the full workspace? <Link href="/workspace" className="font-bold text-[#1D4C8D] underline">Open it directly</Link> — upload also lives under Overview.
        </p>
      </main>
    </div>
  );
}
