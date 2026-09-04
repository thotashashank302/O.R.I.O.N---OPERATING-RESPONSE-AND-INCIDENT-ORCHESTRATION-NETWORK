"use client";

import React, { useState } from "react";
import { MembershipList, MemberItem } from "@/features/identity/MembershipList";
import { RoleGrantModal } from "@/features/role-management/RoleGrantModal";
import { CollegeSetupForm } from "@/features/institutions/CollegeSetupForm";

export default function PrincipalDashboardPage() {
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<MemberItem | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B132B] via-[#070B14] to-[#040810] text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Navigation bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <a
            href="/principal"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
          >
            Governance
          </a>
          <a
            href="/principal#members"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            People &amp; Roles
          </a>
          <a
            href="/principal#structure"
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            Campus Structure &amp; Locations
          </a>
        </div>

        {/* Principal Bootstrap Card (Governance) */}
        <div id="governance" className="scroll-mt-6 rounded-2xl border border-cyan-800/60 bg-gradient-to-r from-cyan-950/40 to-slate-900/60 backdrop-blur-xl p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
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
        <div id="members" className="scroll-mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Institutional Roster &amp; Role Grants</h3>
            <span className="text-xs text-slate-400">Manage HOD, staff, and CR authority</span>
          </div>
          <MembershipList
            onOpenRoleModal={(member) => setSelectedMemberForRole(member)}
          />
        </div>

        {/* Campus Structure & Configuration */}
        <div id="structure" className="scroll-mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Campus Structure &amp; Facilities Setup</h3>
            <span className="text-xs text-slate-400">Departments, blocks, rooms &amp; roster</span>
          </div>
          <CollegeSetupForm />
        </div>
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
