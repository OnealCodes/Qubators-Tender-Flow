"use client";

import { useEffect, useState } from "react";
import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";
import { assignments } from "../../lib/demo-data";

function toneFor(s: string) {
  if (/Received/i.test(s)) return "green";
  if (/Progress/i.test(s)) return "amber";
  return "grey";
}

export default function AssignmentsPage() {
  const [q, setQ] = useState("");
  useEffect(() => {
    const h = (e: Event) => setQ(((e as CustomEvent<string>).detail ?? "").toLowerCase());
    window.addEventListener("tf-search", h);
    return () => window.removeEventListener("tf-search", h);
  }, []);
  const owners = assignments.filter((a) => !q || `${a.owner} ${a.dept}`.toLowerCase().includes(q));

  return (
    <Shell>
      <h1 className="mb-4 text-2xl font-extrabold">Assignments <span className="text-sm font-semibold text-[#5B6472]">(DEMO — My Tasks view per owner)</span></h1>
      <div className="grid gap-4 md:grid-cols-2">
        {owners.map((a) => (
          <Panel key={a.owner} title={`${a.owner} · ${a.dept}`}>
            <ul className="divide-y divide-[#E2E8F0]">
              {a.items.map(([item, state]) => (
                <li key={item} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-semibold">{item}</span>
                  <Badge tone={toneFor(state as string)}>{state}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </Shell>
  );
}

