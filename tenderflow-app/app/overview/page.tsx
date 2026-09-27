import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";
import { buckets, tender } from "../../lib/demo-data";

export default function OverviewPage() {
  return (
    <Shell>
      <h1 className="text-2xl font-extrabold">{tender.client} — {tender.title}</h1>
      <p className="mb-4 mt-1 text-[13px] text-[#5B6472]">Ref: <code className="rounded-md border border-[#E2E8F0] bg-white px-1.5 py-px font-mono text-xs">{tender.ref}</code> · Submission: <strong>{tender.submission}</strong> ({tender.countdown} left) · Clarification: {tender.clarification}</p>
      <Panel title="Tender overview (DEMO extraction)">
        <dl className="grid gap-3 py-2 text-sm md:grid-cols-2">
          {[["Client", tender.client], ["Reference", tender.ref], ["Submission deadline", `${tender.submission} (${tender.countdown} left)`], ["Clarification meeting", tender.clarification], ["Submission format", tender.format], ["Source grounding", "Every requirement links back to its tender section/page (Sec + p.)"]].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] p-3"><dt className="text-xs font-bold uppercase tracking-wider text-[#5B6472]">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>
          ))}
        </dl>
      </Panel>
      <Panel title="Requirement buckets (DEMO)">
        <div className="flex flex-wrap gap-2 py-2">
          {buckets.map((b) => (<span key={b.name}><Badge tone="blue">{b.name}: {b.count}</Badge></span>))}
          <span className="text-sm text-[#5B6472]">Total: 83 requirements · 126 deliverables (PRD shape)</span>
        </div>
      </Panel>
    </Shell>
  );
}

