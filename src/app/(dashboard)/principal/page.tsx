"use client";

import React, { useState } from "react";
import { MembershipList, MemberItem } from "@/features/identity/MembershipList";
import { RoleGrantModal } from "@/features/role-management/RoleGrantModal";
import { CollegeSetupForm } from "@/features/institutions/CollegeSetupForm";

export default function PrincipalDashboardPage() {
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<MemberItem | null>(null);

  return (
    <div className="space-y-8 px-4 py-8 sm:px-8">
      {/* Governance banner */}
      <div id="governance" className="scroll-mt-6 rounded-2xl border border-stone-200 bg-white/80 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-mono font-semibold uppercase tracking-wider">
            PRINCIPAL GOVERNANCE
          </div>
          <h2 className="text-xl font-bold">Active institution context</h2>
          <p className="text-xs text-stone-500 max-w-2xl">
            Principal maintains highest institutional governance: approves institutions, delegates HOD authority, and reviews safety overrides.
          </p>
        </div>
        <span className="text-xs text-cyan-700">Selected through your authenticated membership</span>
      </div>

      {/* Executive Authority & Roles */}
      <div id="members" className="scroll-mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Institutional Roster &amp; Role Grants</h3>
          <span className="text-xs text-stone-500">Manage HOD, staff, and CR authority</span>
        </div>
        <MembershipList
          onOpenRoleModal={(member) => setSelectedMemberForRole(member)}
        />
      </div>

      {/* Campus Structure & Configuration */}
      <div id="structure" className="scroll-mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Campus Structure &amp; Facilities Setup</h3>
          <span className="text-xs text-stone-500">Departments, blocks, rooms &amp; roster</span>
        </div>
        <CollegeSetupForm />
      </div>

      {selectedMemberForRole && (
        <RoleGrantModal
          member={selectedMemberForRole}
          onClose={() => setSelectedMemberForRole(null)}
        />
      )}
    </div>
  );
}
