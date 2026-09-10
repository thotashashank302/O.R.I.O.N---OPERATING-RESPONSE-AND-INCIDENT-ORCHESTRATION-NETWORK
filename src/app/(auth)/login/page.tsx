"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./login.module.css";

export default function LoginPage() {
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
      if (!email || !password) {
        setError("Please enter both email and password.");
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as {
        data?: { destination?: string };
        error?: { message?: string };
      };
      if (!response.ok || !payload.data?.destination) {
        throw new Error(payload.error?.message ?? "Failed to sign in. Check your credentials.");
      }
      window.location.assign(payload.data.destination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.login} min-h-screen w-full flex flex-col md:flex-row bg-[#191816] text-white antialiased`}>
      <div className="relative min-h-[42vh] md:min-h-screen md:w-[58%] flex flex-col justify-between p-7 sm:p-10 lg:p-14 overflow-hidden">
        <Image
          src="/images/orion-campus-login.webp"
          alt="Modern university campus building at night"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 58vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,12,22,.28),rgba(3,12,22,.1)_55%,rgba(3,12,22,.48)),linear-gradient(0deg,rgba(2,8,16,.92),transparent_48%,rgba(2,8,16,.36))]" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-6 w-6 place-items-center border border-white/35 bg-black/20">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c8b38f]" />
          </span>
          <span className="text-[13px] tracking-[.19em] text-white uppercase font-semibold">ORION</span>
          <span className="text-[10px] tracking-[.18em] text-white/58 uppercase">Campus Operations</span>
        </div>

        <div className="relative z-10 max-w-lg">
          <p className="mb-4 text-[10px] uppercase tracking-[.18em] text-white/65">North campus · Operations node 03</p>
          <h1 className="font-[Georgia] text-[clamp(1.6rem,2.4vw,2.65rem)] leading-[1.12] tracking-[-.025em] text-white">
            One console for facilities, access, incidents and scheduling across every building.
          </h1>
          <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2 border-t border-white/20 pt-4 text-[11px] text-white/65">
            <span><strong className="mr-1 text-white">4 agents</strong> with bounded tools</span>
            <span><strong className="mr-1 text-white">Human</strong> verification enforced</span>
          </div>
        </div>
      </div>

      <div className="md:w-[42%] flex flex-col justify-between p-7 sm:p-10 lg:p-14 bg-[#191816]">
        <div className="max-w-md w-full mx-auto my-auto py-8">
          <div className="text-[10px] font-medium tracking-[.18em] text-[#c8b38f] uppercase mb-5">
            AUTHORIZED PERSONNEL
          </div>

          <h2 className="font-[Georgia] text-3xl md:text-[2.15rem] font-normal text-white tracking-[-.025em] mb-2">
            Sign in to ORION
          </h2>
          <p className="text-sm text-[#b4aea3] mb-9">
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
              <label className="block text-xs font-medium text-[#d8d1c5] mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full px-4 py-3.5 rounded-md bg-[#22211e] border border-[#575147] text-sm text-white placeholder-[#a69f93] focus:outline-none focus:border-[#c8b38f] focus:ring-1 focus:ring-[#c8b38f] transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-[#d8d1c5]">
                  Password
                </label>
                <a
                  href="/forgot-password"
                  className="text-xs text-[#b4aea3] hover:text-[#c8b38f] transition-colors"
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
                  className="w-full px-4 py-3.5 pr-10 rounded-md bg-[#22211e] border border-[#575147] text-sm text-white placeholder-[#a69f93] focus:outline-none focus:border-[#c8b38f] focus:ring-1 focus:ring-[#c8b38f] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b4aea3] hover:text-[#eee6d9]"
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
              <label className="flex items-center gap-2 text-[#d8d1c5] cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="rounded border-[#575147] bg-[#22211e] text-[#c8b38f] accent-[#c8b38f] focus:ring-[#c8b38f]"
                />
                Keep me signed in on this device
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-md bg-[#c8b38f] hover:bg-[#dcc9a9] text-[#211e19] font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_12px_30px_rgba(0,0,0,.18)] transition-all disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Continue →"}
            </button>

          </form>

          {/* Student Roster Claim Link */}
          <div className="mt-8 text-center text-xs text-[#b4aea3]">
            Are you a student with a college roll number?{" "}
            <Link
              href="/register"
              className="text-[#c8b38f] hover:text-[#e0ceb0] font-medium underline underline-offset-4 ml-1"
            >
              Claim Roster Membership →
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-md w-full mx-auto flex items-center justify-between text-xs text-[#a69f93] border-t border-[#423e37] pt-4">
          <span>© 2026 ORION Systems</span>
          <div className="flex items-center gap-4">

          </div>
        </div>
      </div>
    </div>
  );
}
