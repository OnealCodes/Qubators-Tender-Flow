export const toneBg: Record<string, string> = {
  green: "bg-[#E7F6EC] text-[#0F6B2E] border-[#B9E3C4]",
  amber: "bg-[#FDF1DE] text-[#8A4B00] border-[#F2D3A0]",
  red: "bg-[#FDECEC] text-[#9B1C1C] border-[#F3B8B8]",
  grey: "bg-[#EEF1F4] text-[#4B5563] border-[#D3D8DE]",
  purple: "bg-[#EFE7FD] text-[#5B21B6] border-[#D3C2F8]",
  blue: "bg-[#E6EEFD] text-[#1D4ED8] border-[#B9CCF5]",
};

export function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`badge border ${toneBg[tone] ?? toneBg.grey}`}>{children}</span>;
}

export function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#E2E8F0] p-3.5">
        <h2 className="text-base font-bold">{title}</h2>
        {right && <span className="ml-auto flex flex-wrap gap-2">{right}</span>}
      </div>
      <div className="px-4 pb-3.5 pt-1.5">{children}</div>
    </div>
  );
}

// Broadcast the shell search box to route pages without new dependencies.
export function emitSearch(q: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tf-search", { detail: q }));
  }
}

export function useShellSearch(onQuery: (q: string) => void) {
  // Helper to be used with useEffect in pages.
  return () => {
    const handler = (e: Event) => onQuery((e as CustomEvent<string>).detail ?? "");
    window.addEventListener("tf-search", handler);
    return () => window.removeEventListener("tf-search", handler);
  };
}
