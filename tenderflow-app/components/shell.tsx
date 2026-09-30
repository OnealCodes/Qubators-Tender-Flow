"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient, useSession } from "../lib/auth-client";
import { tender } from "../lib/demo-data";
import { emitSearch } from "./ui";

function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);
  const user = session?.user as unknown as { name?: string; email?: string; role?: string } | undefined;
  const initials = (user?.name ?? user?.email ?? "?").trim().slice(0, 2).toUpperCase();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  if (isPending) {
    return <div className="h-[34px] w-[34px] rounded-full bg-[#E2E8F0]" aria-label="Loading session" />;
  }
  if (!user) {
    return (
      <Link href="/sign-in" className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-bold text-[#0A2C4E]">
        Sign in
      </Link>
    );
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-[34px] min-w-[34px] items-center justify-center gap-1 rounded-full bg-[#0A2C4E] px-2 text-[13px] font-bold text-white"
        title={`${user.name ?? user.email} (${user.role ?? "contributor"})`}
        aria-haspopup="menu"
      >
        {initials}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm shadow-xl">
          <div className="font-bold">{user.name}</div>
          <div className="text-xs text-[#5B6472]">{user.email}</div>
          <div className="mt-1 inline-block rounded-full bg-[#EEF1F4] px-2 py-0.5 text-xs font-bold">{user.role ?? "contributor"}</div>
          <div className="mt-2 flex flex-col gap-1">
            <Link href="/team" className="rounded px-2 py-1.5 font-semibold hover:bg-[#F6F7F9]">Team &amp; roles</Link>
            <button onClick={signOut} className="rounded px-2 py-1.5 text-left font-semibold text-[#DC2626] hover:bg-[#FDECEC]">Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data: session, isPending } = useSession();

  // Second gate behind the middleware cookie check: an expired or revoked
  // session bounces to sign-in even if a stale cookie is present.
  useEffect(() => {
    if (!isPending && !session) {
      router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  }, [isPending, session, pathname, router]);

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
          <Link href="/team" className={`rounded-lg px-3 py-2.5 text-left text-sm ${pathname === "/team" ? "bg-[#12385F] text-white shadow-[inset_3px_0_0_#F5B301]" : "text-slate-300 hover:bg-[#12385F] hover:text-white"}`}>
            Team
          </Link>
          {["Library", "Expiry", "Settings"].map((item) => (
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
          <UserMenu />
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
