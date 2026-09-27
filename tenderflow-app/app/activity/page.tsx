import Shell from "../../components/shell";
import { Panel } from "../../components/ui";
import { activity } from "../../lib/demo-data";

export default function ActivityPage() {
  return (
    <Shell>
      <h1 className="mb-4 text-2xl font-extrabold">Activity <span className="text-sm font-semibold text-[#5B6472]">(DEMO audit trail)</span></h1>
      <Panel title="Tender timeline">
        <ol className="relative ml-2 border-l-2 border-[#E2E8F0]">
          {activity.map((a) => (
            <li key={a.time + a.text} className="mb-4 ml-4">
              <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-white bg-[#F5B301]" />
              <div className="font-mono text-xs text-[#5B6472]">{a.time}</div>
              <div className="text-sm font-semibold">{a.text}</div>
            </li>
          ))}
        </ol>
      </Panel>
    </Shell>
  );
}

