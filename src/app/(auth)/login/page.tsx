"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Demo authentication simulation or Supabase auth
      if (!email || !password) {
        setError("Please enter both email and password.");
        setLoading(false);
        return;
      }

      // Demo role-based redirect
      const lowerEmail = email.toLowerCase();
      if (lowerEmail.includes("principal")) {
        router.push("/principal");
      } else if (lowerEmail.includes("admin")) {
        router.push("/admin");
      } else if (lowerEmail.includes("hod")) {
        router.push("/hod");
      } else if (lowerEmail.includes("staff")) {
        router.push("/staff");
      } else {
        router.push("/admin");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-[#070B14] text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
      {/* Left Hero Column (Architectural Operations Aesthetic) */}
      <div className="relative md:w-7/12 flex flex-col justify-between p-8 md:p-14 bg-gradient-to-br from-[#0B132B] via-[#070B14] to-[#040810] border-b md:border-b-0 md:border-r border-slate-800/60 overflow-hidden">
        {/* Subtle Architectural Glow & Grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(56,189,248,0.08),transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
          <span className="font-mono text-sm tracking-widest text-slate-200 uppercase font-semibold">
            ORION
          </span>
          <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">
            CAMPUS OPERATIONS
          </span>
        </div>

        {/* Hero Imagery Simulator / Architectural Card */}
        <div className="relative z-10 my-12 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md p-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/60 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              NODE ACTIVE
            </span>
            <span>LATENCY: 14ms</span>
          </div>
          <div className="py-6">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-2">
              NORTH CAMPUS · OPERATIONS NODE 03
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-white leading-tight">
              One console for facilities, access, incidents and scheduling across every building.
            </h1>
          </div>
          <div className="flex items-center gap-6 pt-4 border-t border-slate-800/60 text-xs text-slate-400">
            <div>
              <span className="text-white font-semibold block">4 Autonomous Agents</span>
              Featherless Reasoning
            </div>
            <div className="border-l border-slate-800/60 pl-6">
              <span className="text-white font-semibold block">College Isolation</span>
              Strict Role Scope
            </div>
          </div>
        </div>

        {/* Bottom Status */}
        <div className="relative z-10 text-xs font-mono text-slate-500">
          SYSTEM CLOCK: UTC+05:30 (ASIA/KOLKATA) · SECURE PROTOCOL v2.0
        </div>
      </div>

      {/* Right Form Column (Sign In Card) */}
      <div className="md:w-5/12 flex flex-col justify-between p-8 md:p-14 bg-[#070B14]">
        <div className="max-w-md w-full mx-auto my-auto py-8">
          {/* Badge */}
          <div className="text-[11px] font-mono font-medium tracking-widest text-cyan-400 uppercase mb-3">
            AUTHORIZED PERSONNEL
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">
            Sign in to ORION
          </h2>
          <p className="text-sm text-slate-400 mb-8">
            Use your institutional credentials to continue.
          </p>

          {error && (
            <div className="mb-6 p-3.5 rounded-lg bg-red-950/50 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full px-4 py-3 rounded-lg bg-slate-900/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
                <a
                  href="#forgot"
                  className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 pr-10 rounded-lg bg-slate-900/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                Keep me signed in on this device
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#070B14] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.25)] transition-all disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Continue →"}
            </button>

            <div className="relative flex items-center justify-center my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative px-3 bg-[#070B14] text-[11px] font-mono uppercase text-slate-500">
                OR
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setEmail("demo.admin@orion.edu");
                setPassword("demo1234");
              }}
              className="w-full py-3 px-4 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-slate-200 text-xs font-medium transition-all"
            >
              Fill Demo Credentials (Admin / Principal)
            </button>
          </form>

          {/* Student Roster Claim Link */}
          <div className="mt-8 text-center text-xs text-slate-400">
            Are you a student with a college roll number?{" "}
            <Link
              href="/register"
              className="text-cyan-400 hover:text-cyan-300 font-medium underline underline-offset-4 ml-1"
            >
              Claim Roster Membership →
            </Link>
          </div>
        </div>

        {/* Footer */}
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
