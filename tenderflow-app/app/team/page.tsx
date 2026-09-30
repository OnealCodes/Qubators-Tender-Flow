"use client";

import { useEffect, useState } from "react";
import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [you, setYou] = useState("");
  const [yourRole, setYourRole] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const j = await fetch("/api/users").then((r) => r.json());
    setMembers(j.users ?? []);
    setYou(j.you ?? "");
    setYourRole(j.yourRole ?? "");
  }

  useEffect(() => {
    refresh();
  }, []);

  async function setRole(id: string, role: string) {
    setNotice(null);
    const r = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setNotice(j.error ?? "Role change failed.");
      return;
    }
    refresh();
  }

  const isManager = yourRole === "manager";

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-extrabold">Team &amp; roles</h1>
      <p className="mb-4 text-sm text-[#5B6472]">
        Two roles only. <strong>Managers</strong> run tenders, assign work, manage the library and approve matches.{" "}
        <strong>Contributors</strong> see their tasks, upload evidence and comment. First account is always a Manager.
      </p>
      {notice && <p className="mb-3 text-sm font-bold text-[#DC2626]">{notice}</p>}
      <Panel title={`Members (${members.length})`}>
        <ul className="divide-y divide-[#E2E8F0]">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <div>
                <div className="font-bold">
                  {m.name} {m.id === you && <span className="text-xs font-normal text-[#5B6472]">(you)</span>}
                </div>
                <div className="text-xs text-[#5B6472]">{m.email}</div>
              </div>
              <span className="ml-auto" />
              <Badge tone={m.role === "manager" ? "blue" : "grey"}>{m.role}</Badge>
              {isManager && m.id !== you ? (
                <select
                  value={m.role}
                  onChange={(e) => setRole(m.id, e.target.value)}
                  className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-xs"
                  aria-label={`Set role for ${m.name}`}
                >
                  <option value="manager">manager</option>
                  <option value="contributor">contributor</option>
                </select>
              ) : (
                <span className="text-xs text-[#5B6472]">{m.id === you ? "you cannot change your own role" : "managers only"}</span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </Shell>
  );
}

