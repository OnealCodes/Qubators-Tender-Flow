// Readiness + final-review engine — pure functions, fully explainable.
// Weighted: Critical ×5, Mandatory ×3, Supporting/Info ×1. Conditional items
// are excluded from the percentage (they must not count as missing) and
// reported separately. Every number drills down to item lists — the % never
// stands alone, so it cannot create false confidence.

export interface ReadinessItem {
  deliverable_id: string;
  requirement_id: string;
  title: string;
  owner: string | null;
  risk: string;
  type: string;
  status: string;
  verdict: string; // effective QC verdict or "not_reviewed"
  section: string;
  req_type: string | null;
}

export interface Readiness {
  percent: number;
  scored: number;
  earned: number;
  counts: { compliant: number; review: number; non_compliant: number; not_reviewed: number };
  critical_outstanding: ReadinessItem[];
  conditional_open: ReadinessItem[];
  total: number;
}

const WEIGHTS: Record<string, number> = {
  critical: 5,
  mandatory: 3,
  supporting: 1,
  info: 1,
};

function scoreOf(item: ReadinessItem): number {
  // Evidence received counts half until QC says otherwise; completion rules:
  // compliant=1, review=0.5, non_compliant=0, not_reviewed = 0.5 if received else 0.
  if (item.verdict === "compliant") return 1;
  if (item.verdict === "review") return 0.5;
  if (item.verdict === "non_compliant") return 0;
  return /received|complete/i.test(item.status) ? 0.5 : 0;
}

export function computeReadiness(items: ReadinessItem[]): Readiness {
  const scored = items.filter((i) => i.risk !== "conditional");
  const conditional_open = items.filter(
    (i) => i.risk === "conditional" && !/received|complete/i.test(i.status)
  );
  let earned = 0;
  let total = 0;
  const counts = { compliant: 0, review: 0, non_compliant: 0, not_reviewed: 0 };
  for (const item of scored) {
    const w = WEIGHTS[item.risk] ?? 1;
    total += w;
    earned += w * scoreOf(item);
    counts[item.verdict as keyof typeof counts]++;
  }
  const critical_outstanding = scored.filter(
    (i) => i.risk === "critical" && !(i.verdict === "compliant" && /received|complete/i.test(i.status))
  );
  return {
    percent: total === 0 ? 0 : Math.round((earned / total) * 100),
    scored: scored.length,
    earned: Math.round(earned * 10) / 10,
    counts,
    critical_outstanding,
    conditional_open,
    total: items.length,
  };
}

export interface FinalGroup {
  group: string;
  state: "pass" | "attention" | "blocked";
  detail: string;
}

// Final Compliance Review groups (§19), computed from the same items.
export function finalReview(items: ReadinessItem[]): { groups: FinalGroup[]; ready: boolean } {
  const scored = items.filter((i) => i.risk !== "conditional");
  const missing = scored.filter((i) => !/received|complete/i.test(i.status));
  const bad = scored.filter((i) => i.verdict === "non_compliant");
  const needsReview = scored.filter((i) => i.verdict === "review");
  const unreviewed = scored.filter((i) => i.verdict === "not_reviewed" && /received|complete/i.test(i.status));

  const group = (group: string, badItems: ReadinessItem[], warnItems: ReadinessItem[], okText: string): FinalGroup => {
    if (badItems.length > 0)
      return { group, state: "blocked", detail: `${badItems.length} blocking: ${badItems.slice(0, 3).map((i) => i.title).join("; ")}${badItems.length > 3 ? "…" : ""}` };
    if (warnItems.length > 0)
      return { group, state: "attention", detail: `${warnItems.length} need attention: ${warnItems.slice(0, 3).map((i) => i.title).join("; ")}${warnItems.length > 3 ? "…" : ""}` };
    return { group, state: "pass", detail: okText };
  };

  const bySection = (names: string[]) => scored.filter((i) => names.includes(i.section));
  const forms = scored.filter((i) => i.req_type === "form");

  const groups: FinalGroup[] = [
    group("Requirements", bad, [...missing, ...needsReview], "Every mandatory requirement addressed."),
    group("Documents", bad.filter((i) => /received|complete/i.test(i.status)), unreviewed, "Required documents present and reviewed."),
    group("Content", bad, needsReview, "Evidence matches requirements."),
    group("Forms", forms.filter((i) => missing.includes(i) || bad.includes(i)), forms.filter((i) => needsReview.includes(i) || unreviewed.includes(i)), forms.length ? "Required forms completed." : "No form requirements in this tender."),
    group("Commercial", sectionBad("Commercial"), sectionWarn("Commercial"), "All pricing items addressed."),
    group("Nigerian Content", sectionBad("Nigerian Content"), sectionWarn("Nigerian Content"), "NCDMB/NOGIC documents present."),
    group("HSE", sectionBad("HSE"), sectionWarn("HSE"), "HSE policies, records and plans included."),
  ];
  const ready = missing.length === 0 && bad.length === 0;
  return { groups, ready };

  function sectionBad(section: string): ReadinessItem[] {
    return bySection([section]).filter((i) => bad.includes(i) || missing.includes(i));
  }
  function sectionWarn(section: string): ReadinessItem[] {
    return bySection([section]).filter((i) => needsReview.includes(i) || unreviewed.includes(i));
  }
}
