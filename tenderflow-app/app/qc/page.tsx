import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";
import { qcChecks } from "../../lib/demo-data";

export default function QcPage() {
  return (
    <Shell>
      <h1 className="mb-4 text-2xl font-extrabold">Quality control <span className="text-sm font-semibold text-[#5B6472]">(DEMO)</span></h1>
      <Panel title="Audited Accounts.pdf" right={<Badge tone="red">■ Potential non-compliance</Badge>}>
        {qcChecks.map((c) => (
          <div key={c.text} className="flex items-start gap-2 border-t border-dashed border-[#E2E8F0] py-[7px] text-sm">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.pass ? "#16A34A" : "#DC2626" }} />
            <span>{c.text}</span>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 py-3 text-xs text-[#5B6472]">
          <span>● Appears compliant</span><span>▲ Review required</span><span>■ Potential non-compliance</span><span>○ Not reviewed</span>
        </div>
      </Panel>
      <Panel title="QC rule">
        <p className="py-2 text-sm">False-compliant results are the failure to avoid: when uncertain, the engine must return <strong>Review required</strong>, and readiness only counts human-accepted evidence.</p>
      </Panel>
    </Shell>
  );
}

