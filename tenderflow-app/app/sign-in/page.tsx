"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "../../lib/auth-client";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/workspace";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await authClient.signIn.email(
      { email: email.trim(), password, callbackURL: next },
      {
        onError: (ctx) => {
          setError(ctx.error.message || "Sign in failed. Check your email and password.");
          setBusy(false);
        },
      }
    );
    if (res?.data) router.push(next);
    else setBusy((b) => (error ? b : false));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-4">
      <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5B301] text-lg font-extrabold text-[#0A2C4E]">T</div>
          <div className="text-lg font-extrabold text-[#0A2C4E]">Tender<span className="text-[#F5B301]">Flow</span></div>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">Sign in</h1>
        <p className="mt-1 text-sm text-[#5B6472]">Your workspace runs on your own machine. First account becomes the Bid Manager.</p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <label className="text-sm font-bold">
            Work email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 font-normal" autoComplete="email" />
          </label>
          <label className="text-sm font-bold">
            Password
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-3 py-2.5 font-normal" autoComplete="current-password" />
          </label>
          {error && <p className="text-sm font-bold text-[#DC2626]">{error}</p>}
          <button disabled={busy} className="rounded-lg bg-[#1D4C8D] px-4 py-3 text-sm font-bold text-white hover:bg-[#14365F] disabled:opacity-50">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-[#5B6472]">
          No account yet? <Link href="/sign-up" className="font-bold text-[#1D4C8D] underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
