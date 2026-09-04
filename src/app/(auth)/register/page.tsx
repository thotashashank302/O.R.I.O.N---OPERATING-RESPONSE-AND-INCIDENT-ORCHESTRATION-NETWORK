"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/features/auth/supabase-browser";
import { fetchAuthenticatedContexts } from "@/features/auth/context";
import { dashboardRouteForContexts } from "@/features/auth/dashboard-route";

const PENDING_CLAIM_KEY = "orion.pending-roster-claim";

type PendingClaim = { institution_code: string; roll_number: string };

export default function RegisterPage() {
  const router = useRouter();
  const [collegeCode, setCollegeCode] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const claimMembership = useCallback(async (claim: PendingClaim) => {
    const res = await fetch("/api/memberships/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(claim),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message || "Failed to claim roster membership.");

    window.localStorage.removeItem(PENDING_CLAIM_KEY);
    const contexts = await fetchAuthenticatedContexts();
    router.replace(dashboardRouteForContexts(contexts) ?? "/student");
    router.refresh();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const finishConfirmedClaim = async () => {
      const pending = window.localStorage.getItem(PENDING_CLAIM_KEY);
      if (!pending) return;
      const { data } = await createSupabaseBrowserClient().auth.getUser();
      if (!data.user || cancelled) return;
      setLoading(true);
      try {
        await claimMembership(JSON.parse(pending) as PendingClaim);
      } catch (reason: unknown) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to claim membership.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void finishConfirmedClaim();
    return () => { cancelled = true; };
  }, [claimMembership]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const claim = {
        institution_code: collegeCode.trim().toUpperCase(),
        roll_number: rollNumber.trim().toUpperCase(),
      };
      window.localStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(claim));

      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/register`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        await claimMembership(claim);
        return;
      }

      setSuccess("Account created. Check your email to verify it; ORION will finish the roster claim when you return.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register. Ensure your email matches the roster.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#070B14] text-white antialiased selection:bg-cyan-500 selection:text-black">
      <div className="relative min-h-[38vh] md:min-h-screen md:w-[58%] flex flex-col justify-between p-8 md:p-14 overflow-hidden">
        <Image src="/images/orion-campus-login.webp" alt="Modern university campus building at night" fill priority sizes="(max-width: 768px) 100vw, 58vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(2,8,16,.92),transparent_52%,rgba(2,8,16,.38)),linear-gradient(90deg,rgba(3,12,22,.2),rgba(3,12,22,.5))]" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-6 w-6 place-items-center border border-white/35 bg-black/20"><span className="h-1.5 w-1.5 rounded-full bg-[#63b5d7]" /></span>
          <span className="text-sm tracking-widest text-slate-200 uppercase font-semibold">
            ORION
          </span>
          <span className="text-[10px] tracking-widest text-slate-400 uppercase">
            ROSTER-BOUND ONBOARDING
          </span>
        </div>

        <div className="relative z-10 my-12 max-w-xl">
          <p className="text-[10px] uppercase tracking-[.18em] text-[#8dc7df] mb-3">Roster-bound onboarding</p>
          <h1 className="font-[Georgia] text-3xl md:text-4xl font-normal text-white leading-tight mb-4">
            Verify your official college identity against your institution&apos;s secured roster.
          </h1>
          <p className="max-w-lg text-sm text-white/65 leading-relaxed">
            Students cannot claim arbitrary accounts or join unauthorized colleges. Your roll number must match your institutional email recorded in the official campus database.
          </p>
        </div>

        <div className="relative z-10 text-[10px] uppercase tracking-[.16em] text-white/48">
          Verified email and roster match required
        </div>
      </div>

      {/* Right Column (Register / Claim Form) */}
      <div className="md:w-[42%] flex flex-col justify-between p-8 md:p-14 bg-[#070B14]">
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <div className="text-[11px] font-mono font-medium tracking-widest text-cyan-400 uppercase mb-3">
            STUDENT REGISTRATION
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">
            Claim College Identity
          </h2>
          <p className="text-sm text-slate-400 mb-8">
            Enter your college code and matching institutional credentials.
          </p>

          {error && (
            <div className="mb-6 p-3.5 rounded-lg bg-red-950/50 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-3.5 rounded-lg bg-emerald-950/50 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {success}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                College / Institution Code
              </label>
              <input
                type="text"
                required
                value={collegeCode}
                onChange={(e) => setCollegeCode(e.target.value.toUpperCase())}
                placeholder="e.g. ORION-DEMO"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Student Roll Number
              </label>
              <input
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 2024CSB101"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Institutional Email (Must Match Roster)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Set Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || Boolean(success)}
              className="w-full mt-2 py-3 px-4 rounded-lg bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#070B14] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.25)] transition-all disabled:opacity-50"
            >
              {loading ? "Verifying Roster Match..." : "Verify & Claim Identity →"}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-slate-400">
            Already registered?{" "}
            <Link
              href="/login"
              className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-4 ml-1"
            >
              Sign In to Console →
            </Link>
          </div>
        </div>

        <div className="max-w-md w-full mx-auto flex items-center justify-between text-xs text-slate-500 border-t border-slate-850 pt-4">
          <span>© 2026 ORION Systems</span>
          <div className="flex items-center gap-4">
            <a href="#privacy" className="hover:text-slate-400">Privacy</a>
            <a href="#status" className="hover:text-slate-400">Status</a>
          </div>
        </div>
      </div>
    </div>
  );
}
