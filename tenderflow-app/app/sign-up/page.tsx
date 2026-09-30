"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authClient.signUp.email(
      { name: name.trim(), email: email.trim(), password, callbackURL: "/workspace" },
      {
        onError: (ctx) => {
          setError(ctx.error.message || "Sign up failed. Try a stronger password (8+ characters).");
          setBusy(false);
        },
      }
    );
    if (res?.data) router.push("/workspace");
    else setBusy((b) => (error ? b : false));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-4">
      <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5B301] text-lg font-extrabold text-[#0A2C4E]">T</div>
          <div className="text-lg font-extrabold text-[#0A2C4E]">Tender<span className="text-[#F5B301]">Flow</span></div>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">Create your account</h1>
        <p className="mt-1 text-sm text-[#5B6472]">
          The first account on this machine becomes the <strong>Bid Manager</strong>. Everyone after that joins as a <strong>Contributor</strong> until promoted.
        </p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <label className="text-sm font-bold">
            Full name
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 font-normal" autoComplete="name" />
          </label>
          <label className="text-sm font-bold">
            Work email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 font-normal" autoComplete="email" />
          </label>
          <label className="text-sm font-bold">
            Password (8+ characters)
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 font-normal" autoComplete="new-password" />
          </label>
          {error && <p className="text-sm font-bold text-[#DC2626]">{error}</p>}
          <button disabled={busy} className="rounded-lg bg-[#F5B301] px-4 py-3 text-sm font-extrabold text-[#0A2C4E] hover:bg-[#FFC81A] disabled:opacity-50">
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-sm text-[#5B6472]">
          Already have one? <Link href="/sign-in" className="font-bold text-[#1D4C8D] underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
