"use client";

import React, { useState } from "react";
import { MembershipList, MemberItem } from "@/features/identity/MembershipList";
import { RoleGrantModal } from "@/features/role-management/RoleGrantModal";
import { CollegeSetupForm } from "@/features/institutions/CollegeSetupForm";
import { CATEGORY_HANDLER_MAP } from "@/contracts/category-handlers";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<"members" | "setup" | "cr_seats" | "handlers">("members");
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<MemberItem | null>(null);

  React.useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "members" || hash === "setup" || hash === "cr_seats" || hash === "handlers") {
        setActiveTab(hash);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  return (
    <div className="space-y-8 px-4 py-8 sm:px-8">
      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/80 border border-stone-200">
          <div className="text-[11px] font-mono text-stone-500 uppercase">Verified Members</div>
          <div className="text-2xl font-bold mt-1">—</div>
          <div className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1">
            <span>●</span> Awaiting live membership summary
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white/80 border border-stone-200">
          <div className="text-[11px] font-mono text-stone-500 uppercase">Active CR Seats</div>
          <div className="text-2xl font-bold text-cyan-700 mt-1">—</div>
          <div className="text-[11px] text-stone-500 mt-2">2 Seats Max Per Section</div>
        </div>
        <div className="p-5 rounded-2xl bg-white/80 border border-stone-200">
          <div className="text-[11px] font-mono text-stone-500 uppercase">Staff On Duty</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">—</div>
          <div className="text-[11px] text-stone-500 mt-2">Default Off-Duty Enforced</div>
        </div>
        <div className="p-5 rounded-2xl bg-white/80 border border-stone-200">
          <div className="text-[11px] font-mono text-stone-500 uppercase">Campus Location Nodes</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">—</div>
          <div className="text-[11px] text-purple-700 mt-2">Blocks, Rooms & Labs</div>
        </div>
      </div>

      {/* Dashboard Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        <button
          onClick={() => setActiveTab("members")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "members"
              ? "bg-stone-800 text-white shadow-md"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200"
          }`}
        >
          Membership & Role Matrix
        </button>
        <button
          onClick={() => setActiveTab("cr_seats")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "cr_seats"
              ? "bg-stone-800 text-white shadow-md"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200"
          }`}
        >
          Two-Seat CR Oversight
        </button>
        <button
          onClick={() => setActiveTab("setup")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "setup"
              ? "bg-stone-800 text-white shadow-md"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200"
          }`}
        >
          Campus Structure & Roster
        </button>
        <button
          onClick={() => setActiveTab("handlers")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "handlers"
              ? "bg-stone-800 text-white shadow-md"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200"
          }`}
        >
          Category & Responsible Handlers
        </button>
      </div>

      {/* Tab 1: Memberships */}
      {activeTab === "members" && (
        <MembershipList
          onOpenRoleModal={(member) => setSelectedMemberForRole(member)}
        />
      )}

      {/* Tab 2: Two-Seat CR Oversight */}
      {activeTab === "cr_seats" && (
        <div className="rounded-2xl border border-stone-200 bg-white/80 p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Section-Level CR Dual-Seat Allocation</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Every section is strictly capped at two concurrent CR seats (Seat 1 & Seat 2) per term.
            </p>
          </div>
          <div className="mt-2 border border-dashed border-stone-300 rounded-xl p-6 text-sm text-stone-500">
            Current CR appointments are shown from live grants in the Membership &amp; Role Matrix. Select a verified member there to assign or replace Seat 1 or Seat 2; ORION never fills this view with example identities.
          </div>
        </div>
      )}

      {/* Tab 3: Setup & Roster */}
      {activeTab === "setup" && <CollegeSetupForm />}

      {/* Tab 4: Responsible Handlers */}
      {activeTab === "handlers" && (
        <div className="rounded-2xl border border-stone-200 bg-white/80 p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Incident Category to Responsible Group Mapping</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Authoritative routing policy from Revision 2 execution decisions.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-[11px] font-mono uppercase text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Responsible Group</th>
                  <th className="py-3 px-4">Default Verifier</th>
                  <th className="py-3 px-4">Safety Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {Object.entries(CATEGORY_HANDLER_MAP).map(([cat, info]) => (
                  <tr key={cat} className="hover:bg-stone-50">
                    <td className="py-3 px-4 font-medium">{cat}</td>
                    <td className="py-3 px-4 text-cyan-700 font-mono">{info.responsibleGroup}</td>
                    <td className="py-3 px-4 text-stone-600">{info.defaultVerifier}</td>
                    <td className="py-3 px-4">
                      {info.isSafetyCritical ? (
                        <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-[10px] font-semibold">
                          CRITICAL
                        </span>
                      ) : (
                        <span className="text-stone-400 text-[10px]">Standard</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Grant Modal */}
      {selectedMemberForRole && (
        <RoleGrantModal
          member={selectedMemberForRole}
          onClose={() => setSelectedMemberForRole(null)}
        />
      )}
    </div>
  );
}
