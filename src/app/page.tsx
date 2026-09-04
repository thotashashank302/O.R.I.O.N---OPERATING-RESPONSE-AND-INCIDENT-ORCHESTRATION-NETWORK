import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-white p-6 md:p-12">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="font-mono font-bold tracking-widest text-indigo-400">O.R.I.O.N</span>
        </div>
        <div className="text-xs text-slate-400 font-mono">Autonomous Campus Operations</div>
      </header>

      <main className="max-w-3xl my-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 text-xs font-semibold">
          <span>🛡️</span>
          <span>Developer 3 Module: Reporting, Triage & Verification</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
          Fast, Safe & Accountable Campus Incident Response.
        </h1>

        <p className="text-base text-slate-300 max-w-xl">
          Empowering students and class representatives to report equipment faults, signal community impact through voting, and conduct verifiable human confirmations.
        </p>

        <div className="flex gap-4 pt-4 flex-wrap">
          <Link
            href="/student"
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl shadow-lg transition text-sm flex items-center gap-2"
          >
            <span>Launch Student Portal</span>
            <span>→</span>
          </Link>
          <Link
            href="/cr"
            className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold rounded-xl transition text-sm flex items-center gap-2"
          >
            <span>Class Representative Portal</span>
            <span>→</span>
          </Link>
        </div>
      </main>

      <footer className="text-xs text-slate-500 flex justify-between border-t border-slate-800 pt-6">
        <span>ORION Autonomous Incident Orchestration Network</span>
        <span>Developer 3 — Jasvitha</span>
      </footer>
    </div>
  );
}
