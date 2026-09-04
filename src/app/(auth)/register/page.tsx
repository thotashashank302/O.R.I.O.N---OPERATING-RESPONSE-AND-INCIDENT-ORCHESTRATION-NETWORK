"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [collegeCode, setCollegeCode] = useState("ORION-DEMO");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Call claim API to verify roster binding
      const res = await fetch("/api/memberships/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution_code: collegeCode,
          roll_number: rollNumber,
          email: email,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to claim roster membership.");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/admin");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to register. Ensure your email matches the roster.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#070B14] text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
      {/* Left Column (Hero) */}
      <div className="relative md:w-7/12 flex flex-col justify-between p-8 md:p-14 bg-gradient-to-br from-[#0B132B] via-[#070B14] to-[#040810] border-b md:border-b-0 md:border-r border-slate-800/60 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(56,189,248,0.08),transparent_50%)] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
          <span className="font-mono text-sm tracking-widest text-slate-200 uppercase font-semibold">
            ORION
          </span>
          <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">
            ROSTER-BOUND ONBOARDING
          </span>
        </div>

        <div className="relative z-10 my-12 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-6 shadow-2xl">
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-2">
            ZERO IMPERSONATION GUARANTEE
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white leading-tight mb-4">
            Verify your official college identity against your institution's secured roster.
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Students cannot claim arbitrary accounts or join unauthorized colleges. Your roll number must match your institutional email recorded in the official campus database.
          </p>
        </div>

        <div className="relative z-10 text-xs font-mono text-slate-500">
          SECURE PROTOCOL v2.0 · INVARIANT ID-01 ENFORCED
        </div>
      </div>

      {/* Right Column (Register / Claim Form) */}
      <div className="md:w-5/12 flex flex-col justify-between p-8 md:p-14 bg-[#070B14]">
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
              Roster verified! Membership activated. Redirecting...
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
              disabled={loading || success}
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
