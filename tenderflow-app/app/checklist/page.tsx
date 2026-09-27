import Shell from "../../components/shell";
import { Badge, Panel } from "../../components/ui";
import { checklistGroups } from "../../lib/demo-data";

function toneFor(s: string) {
  if (/Issue/i.test(s)) return "red";
  if (/Review/i.test(s)) return "amber";
  if (/progress/i.test(s)) return "blue";
  return "grey";
}

export default function ChecklistPage() {
  return (
    <Shell>
      <h1 className="mb-4 text-2xl font-extrabold">Final compliance checklist <span className="text-sm font-semibold text-[#5B6472]">(DEMO)</span></h1>
      <div className="grid gap-4 md:grid-cols-2">
        {checklistGroups.map((g) => (
          <Panel key={g.group} title={g.group}>
            <ul className="divide-y divide-[#E2E8F0]">
              {g.items.map(([item, state]) => (
                <li key={item} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{item}</span>
                  <Badge tone={toneFor(state as string)}>{state}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
      <p className="py-2 text-sm text-[#5B6472]">End state is <strong>Ready for final human review</strong> — the app never auto-submits.</p>
    </Shell>
  );
}

