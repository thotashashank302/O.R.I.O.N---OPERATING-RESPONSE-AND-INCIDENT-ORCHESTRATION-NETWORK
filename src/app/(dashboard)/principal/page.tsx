"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ContextSwitcher } from "@/features/identity/ContextSwitcher";
import { MembershipList, MemberItem } from "@/features/identity/MembershipList";
import { RoleGrantModal } from "@/features/role-management/RoleGrantModal";

export default function PrincipalDashboardPage() {
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<MemberItem | null>(null);
  const [bootstrapStatus, setBootstrapStatus] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const handleApproveCollege = async () => {
    setApproving(true);
    setBootstrapStatus("Approving demo college bootstrap...");
    try {
      const res = await fetch("/api/institutions/demo-inst-01/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_email: "principal@orion.edu" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Bootstrap approval failed");
      setBootstrapStatus("SUCCESS: College 'ORION-DEMO' approved and active for institutional operations.");
    } catch (err: unknown) {
      setBootstrapStatus(
        `Notice: ${err instanceof Error ? err.message : "Bootstrap approval failed"}`
      );
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B132B] via-[#070B14] to-[#040810] text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
            <span className="font-mono text-sm tracking-widest text-white uppercase font-bold">
              ORION
            </span>
            <span className="text-xs font-mono text-cyan-400 uppercase border-l border-slate-700 pl-2.5">
              PRINCIPAL EXECUTIVE CONSOLE
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <ContextSwitcher />
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-all border border-slate-700"
          >
            Sign Out
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Principal Bootstrap Card */}
        <div className="rounded-2xl border border-cyan-800/60 bg-gradient-to-r from-cyan-950/40 to-slate-900/60 backdrop-blur-xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-semibold uppercase tracking-wider">
              DEMO PRINCIPAL BOOTSTRAP
            </div>
            <h2 className="text-xl font-bold text-white">ORION Institute of Technology (ORION-DEMO)</h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Principal maintains highest institutional governance: approves institutions, delegates HOD authority, and reviews safety overrides.
            </p>
          </div>

          <button
            onClick={handleApproveCollege}
            disabled={approving}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all shrink-0 disabled:opacity-50"
          >
            {approving ? "Approving..." : "Re-Verify College Approval"}
          </button>
        </div>

        {bootstrapStatus && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300">
            {bootstrapStatus}
          </div>
        )}

        {/* Executive Authority & Roles */}
        <MembershipList
          onOpenRoleModal={(member) => setSelectedMemberForRole(member)}
        />
      </main>

      {selectedMemberForRole && (
        <RoleGrantModal
          member={selectedMemberForRole}
          onClose={() => setSelectedMemberForRole(null)}
        />
      )}
    </div>
  );
}
