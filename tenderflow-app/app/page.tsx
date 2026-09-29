import Link from "next/link";

const STEPS = [
  {
    n: "1",
    title: "Upload your tender",
    text: "Drop in the ITT package — even 150+ scanned pages. TenderFlow parses every page and keeps a source link on everything it finds.",
  },
  {
    n: "2",
    title: "Work the matrix",
    text: "Each requirement becomes one clear row with its tender reference, owner suggestion, and detail — Technical and Commercial kept apart, post-award clauses set aside.",
  },
  {
    n: "3",
    title: "Check and submit",
    text: "Collect evidence, match your document library, run requirement-level QC, and watch readiness climb to a human-signed final review.",
  },
];

const FEATURES = [
  {
    title: "Responsibility matrix, not reading marathon",
    text: "Numbered, exact-worded rows with full detail blocks — the way an experienced bid controller would lay it out, with every row traceable to its tender page.",
  },
  {
    title: "QC that reads the evidence",
    text: "Uploaded a document? TenderFlow checks years, entities, signatures, templates and expiry against what was actually asked — review-biased, never falsely compliant.",
  },
  {
    title: "Readiness you can defend",
    text: "A weighted score backed by item lists, critical blockers surfaced first, conditional items never counted as missing. Export the final review for sign-off.",
  },
  {
    title: "Your library, reused",
    text: "Certificates and registrations matched to requirements with confidence and expiry badges. Same name plus entity starts a new version — never a silent duplicate.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#111827]">
      {/* Top bar */}
      <header className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5B301] text-lg font-extrabold text-[#0A2C4E]">T</div>
          <div className="text-lg font-extrabold text-[#0A2C4E]">
            Tender<span className="text-[#F5B301]">Flow</span>
          </div>
          <nav className="ml-auto flex items-center gap-2 text-sm font-semibold">
            <Link href="/workspace" className="rounded-lg px-3 py-2 text-[#0A2C4E] hover:bg-[#EEF1F4]">Workspace</Link>
            <Link href="/upload" className="rounded-lg bg-[#1D4C8D] px-4 py-2.5 font-bold text-white hover:bg-[#14365F]">
              Upload your Tender
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-band text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="flex items-center gap-2.5 text-xs font-extrabold uppercase tracking-[0.1em] text-[#FFE08A]">
            <span className="inline-block h-1 w-[34px] rounded bg-[#F5B301]" />
            AI-powered tender workspace for oil &amp; gas bids
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
            Turn a 200-page tender into a bid-ready matrix in minutes.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#C9D6E5]">
            TenderFlow reads your ITT, builds the responsibility matrix with exact tender
            wording, chases owners, matches your document library, and checks every
            requirement before submission. AI suggests — <strong className="text-white">you decide</strong>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/upload"
              className="rounded-lg bg-[#F5B301] px-7 py-3.5 text-base font-extrabold text-[#0A2C4E] hover:bg-[#FFC81A]"
            >
              Upload your Tender
            </Link>
            <Link
              href="/workspace"
              className="rounded-lg border border-white/30 px-7 py-3.5 text-base font-bold text-white hover:bg-white/10"
            >
              Open the workspace
            </Link>
          </div>
          <p className="mt-4 text-sm text-[#9FB2C8]">
            PDF in, matrix out — free while in local pilot. No account, no cloud, your files never leave this machine.
          </p>
        </div>
      </section>

      {/* Chain strip */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4 text-sm font-bold text-[#0A2C4E]">
          {["Upload", "Understand", "Assign", "Collect", "Match", "QC", "Resolve", "Submit"].map((s, i, a) => (
            <span key={s} className="flex items-center gap-3">
              <span>{s}</span>
              {i < a.length - 1 && <span className="text-[#F5B301]">→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-extrabold text-[#0A2C4E]">From ITT to submission in three moves</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-[10px] border border-[#E2E8F0] bg-white p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A2C4E] text-base font-extrabold text-[#F5B301]">
                {s.n}
              </div>
              <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-[#5B6472]">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Link href="/upload" className="rounded-lg bg-[#1D4C8D] px-6 py-3 text-sm font-bold text-white hover:bg-[#14365F]">
            Upload your Tender — start step 1
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-2xl font-extrabold text-[#0A2C4E]">Built like a bid controller thinks</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-[10px] border border-[#E2E8F0] bg-[#F9FAFB] p-5">
                <h3 className="text-base font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-[#5B6472]">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="hero-band text-white">
        <div className="mx-auto max-w-6xl px-5 py-14 text-center">
          <h2 className="text-3xl font-extrabold">Your next bid starts with one upload.</h2>
          <p className="mx-auto mt-2 max-w-xl text-[#C9D6E5]">
            See your own tender as a numbered, exact-worded responsibility matrix — minutes from now.
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-block rounded-lg bg-[#F5B301] px-8 py-3.5 text-base font-extrabold text-[#0A2C4E] hover:bg-[#FFC81A]"
          >
            Upload your Tender
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-6 text-xs text-[#5B6472]">
        TenderFlow — local pilot build. Matching suggests documents; it never approves compliance. Final submission always needs human review.
      </footer>
    </div>
  );
}
