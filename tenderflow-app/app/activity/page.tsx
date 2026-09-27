"use client";

import { useCallback, useEffect, useState } from "react";
import Shell from "../../components/shell";
import { Panel } from "../../components/ui";

interface ActivityT {
  id: string;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  upload: "uploaded tender",
  extract: "ran extraction",
  assign: "assigned owner",
  evidence: "uploaded evidence",
  comment: "commented",
  issue: "flagged an issue",
  clarification: "requested clarification",
  status: "changed status",
};

export default function ActivityPage() {
  const [tenders, setTenders] = useState<{ id: string; title: string }[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<ActivityT[]>([]);

  const load = useCallback(async (id: string) => {
    const j = await fetch(`/api/tenders/${id}/activity`).then((r) => r.json());
    setItems(j.activities ?? []);
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

  return (
    <Shell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold">Activity</h1>
        {tenders.length > 0 && (
          <select value={activeId ?? ""} onChange={(e) => { setActiveId(e.target.value); load(e.target.value); }} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm" aria-label="Select tender">
            {tenders.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
          </select>
        )}
      </div>
      <Panel title={items.length ? `Audit trail (${items.length})` : "Audit trail"}>
        {items.length === 0 ? (
          <p className="py-3 text-sm text-[#5B6472]">No activity yet — uploads, extractions, assignments, evidence, notes and status changes are recorded here automatically.</p>
        ) : (
          <ol className="relative ml-2 border-l-2 border-[#E2E8F0]">
            {items.map((a) => (
              <li key={a.id} className="mb-4 ml-4">
                <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-white bg-[#F5B301]" />
                <div className="font-mono text-xs text-[#5B6472]">{new Date(a.created_at).toLocaleString()} · {a.actor}</div>
                <div className="text-sm font-semibold">{ACTION_LABEL[a.action] ?? a.action}</div>
                {Object.keys(a.payload).length > 0 && (
                  <div className="font-mono text-xs text-[#5B6472]">{JSON.stringify(a.payload)}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </Shell>
  );
}
