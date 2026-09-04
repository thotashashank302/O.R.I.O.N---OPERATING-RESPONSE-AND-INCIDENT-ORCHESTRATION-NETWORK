"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ContextSwitcher } from "@/features/identity/ContextSwitcher";
import { MembershipList, MemberItem } from "@/features/identity/MembershipList";
import { RoleGrantModal } from "@/features/role-management/RoleGrantModal";
import { SignOutButton } from "@/features/auth/SignOutButton";

export default function PrincipalDashboardPage() {
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<MemberItem | null>(null);

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
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Principal Bootstrap Card */}
        <div className="rounded-2xl border border-cyan-800/60 bg-gradient-to-r from-cyan-950/40 to-slate-900/60 backdrop-blur-xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono font-semibold uppercase tracking-wider">
              PRINCIPAL GOVERNANCE
            </div>
            <h2 className="text-xl font-bold text-white">Active institution context</h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Principal maintains highest institutional governance: approves institutions, delegates HOD authority, and reviews safety overrides.
            </p>
          </div>

          <span className="text-xs text-cyan-300">Selected through your authenticated membership</span>
        </div>

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
