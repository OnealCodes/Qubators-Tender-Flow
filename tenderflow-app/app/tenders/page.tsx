"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Shell from "../../components/shell";
import { Badge } from "../../components/ui";

interface Tender {
  id: string;
  client: string | null;
  title: string;
  reference: string | null;
  submission_deadline: string | null;
  file_name: string;
  page_count: number;
  status: string;
  created_at: string;
}

const STATUSES = ["intake", "active", "submitted", "archived"];

function toneFor(status: string) {
  return status === "active" ? "green" : status === "submitted" ? "blue" : status === "archived" ? "grey" : "amber";
}

export default function TendersPage() {
  const router = useRouter();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [filter, setFilter] = useState<"active" | "all" | "archived">("active");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      const j = await fetch("/api/tenders").then((r) => r.json());
      setTenders(j.tenders ?? []);
    } catch {
      setNotice("Could not reach the tender list.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function setStatus(id: string, status: string) {
    const r = await fetch(`/api/tenders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) refresh();
    else setNotice("Status change failed.");
  }

  async function remove(id: string, title: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    const r = await fetch(`/api/tenders/${id}`, { method: "DELETE" });
    if (r.ok) {
      setConfirmDelete(null);
      setNotice(`Deleted "${title}" — database rows and uploaded files removed.`);
      refresh();
    } else {
      setNotice("Delete failed.");
    }
  }

  function open(id: string) {
    try {
      localStorage.setItem("tf-active-tender", id);
    } catch { /* private mode */ }
    router.push("/workspace");
  }

  const visible = tenders.filter((t) =>
    filter === "all" ? true : filter === "archived" ? t.status === "archived" : t.status !== "archived"
  );
  const counts = {
    active: tenders.filter((t) => t.status !== "archived").length,
    archived: tenders.filter((t) => t.status === "archived").length,
  };

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold">Tender library</h1>
        <div className="ml-auto flex gap-1.5 text-sm">
          {(["active", "all", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 font-bold ${filter === f ? "bg-[#0A2C4E] text-white" : "border border-[#E2E8F0] bg-white text-[#0A2C4E]"}`}
            >
              {f === "active" ? `Active (${counts.active})` : f === "archived" ? `Archived (${counts.archived})` : `All (${tenders.length})`}
            </button>
          ))}
        </div>
      </div>
      {notice && <p className="mb-3 text-sm font-semibold text-[#0A2C4E]">{notice}</p>}

      <div className="overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
        <div className="overflow-x-auto">
          <table className="matrix-table w-full min-w-[860px] text-sm" aria-label="Tender library">
            <thead>
              <tr>
                {["Tender", "Deadline", "Status", "Uploaded", ""].map((h) => (
                  <th key={h} className="px-3.5 py-3 text-left text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="border-t border-[#E2E8F0] bg-white">
                  <td className="px-3.5 py-3.5">
                    <div className="font-bold">{t.title}</div>
                    <div className="text-xs text-[#5B6472]">
                      {[t.client, t.reference, `${t.page_count}p`, t.file_name].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-3.5 py-3.5">{t.submission_deadline ?? "—"}</td>
                  <td className="px-3.5 py-3.5">
                    <Badge tone={toneFor(t.status)}>{t.status}</Badge>
                    <select
                      value={t.status}
                      onChange={(e) => setStatus(t.id, e.target.value)}
                      className="ml-2 rounded border border-[#E2E8F0] bg-white px-1.5 py-1 text-xs"
                      aria-label={`Set status for ${t.title}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3.5 py-3.5 text-xs text-[#5B6472]">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-3.5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => open(t.id)} className="rounded bg-[#1D4C8D] px-3 py-1 text-xs font-bold text-white">Open</button>
                      {confirmDelete === t.id ? (
                        <>
                          <span className="self-center text-xs font-bold text-[#DC2626]">Delete forever?</span>
                          <button onClick={() => remove(t.id, t.title)} className="rounded bg-[#DC2626] px-3 py-1 text-xs font-bold text-white">Yes, delete</button>
                          <button onClick={() => setConfirmDelete(null)} className="rounded border border-[#E2E8F0] px-3 py-1 text-xs">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => remove(t.id, t.title)} className="rounded border border-[#E2E8F0] px-3 py-1 text-xs font-bold text-[#DC2626]">Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3.5 py-6 text-center text-sm text-[#5B6472]">
                    {filter === "archived" ? "Nothing archived — archive finished bids to clear the workspace." : "No tenders here yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="py-3 text-xs text-[#5B6472]">
        Archive hides bids from the workspace picker without losing anything. Delete removes database rows and uploaded files permanently — archive first if unsure.
      </p>
    </Shell>
  );
}

