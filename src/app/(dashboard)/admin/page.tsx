"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ContextSwitcher } from "@/features/identity/ContextSwitcher";
import { MembershipList, MemberItem } from "@/features/identity/MembershipList";
import { RoleGrantModal } from "@/features/role-management/RoleGrantModal";
import { CollegeSetupForm } from "@/features/institutions/CollegeSetupForm";
import { CATEGORY_HANDLER_MAP } from "@/contracts/category-handlers";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<"members" | "setup" | "cr_seats" | "handlers">("members");
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<MemberItem | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B132B] via-[#070B14] to-[#040810] text-slate-100 antialiased selection:bg-cyan-500 selection:text-black">
      {/* Background Constellation Wave Network Overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.12),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(168,85,247,0.08),transparent_40%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      {/* Top Navigation Header */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
            <span className="font-mono text-sm tracking-widest text-white uppercase font-bold">
              ORION
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase border-l border-slate-700 pl-2.5">
              ADMINISTRATION CONSOLE
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

      {/* Main Content Area */}
      <main className="relative z-10 max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* KPI Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80 shadow-lg">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Verified Members</div>
            <div className="text-2xl font-bold text-white mt-1">—</div>
            <div className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
              <span>●</span> Awaiting live membership summary
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80 shadow-lg">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Active CR Seats</div>
            <div className="text-2xl font-bold text-cyan-400 mt-1">—</div>
            <div className="text-[11px] text-slate-400 mt-2">2 Seats Max Per Section</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80 shadow-lg">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Staff On Duty</div>
            <div className="text-2xl font-bold text-amber-300 mt-1">—</div>
            <div className="text-[11px] text-slate-400 mt-2">Default Off-Duty Enforced</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80 shadow-lg">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Campus Location Nodes</div>
            <div className="text-2xl font-bold text-purple-300 mt-1">—</div>
            <div className="text-[11px] text-purple-400 mt-2">Blocks, Rooms & Labs</div>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "members"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "bg-slate-900/70 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            Membership & Role Matrix
          </button>
          <button
            onClick={() => setActiveTab("cr_seats")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "cr_seats"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "bg-slate-900/70 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            Two-Seat CR Oversight
          </button>
          <button
            onClick={() => setActiveTab("setup")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "setup"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "bg-slate-900/70 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            Campus Structure & Roster
          </button>
          <button
            onClick={() => setActiveTab("handlers")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "handlers"
                ? "bg-cyan-500 text-slate-950 shadow-md"
                : "bg-slate-900/70 text-slate-300 hover:bg-slate-800 border border-slate-800"
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
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Section-Level CR Dual-Seat Allocation</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every section is strictly capped at two concurrent CR seats (Seat 1 & Seat 2) per term.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {[
                { dept: "Computer Science", sec: "Section A", s1: "Rahul Verma (2024CSB101)", s2: "Pooja Sharma (2024CSB102)", status: "Full" },
                { dept: "Computer Science", sec: "Section B", s1: "Aditya Roy (2024CSB201)", s2: "Open Seat 2", status: "1 Seat Available" },
                { dept: "Electrical Engg", sec: "Section A", s1: "Sneha Nair (2024EEA101)", s2: "Kiran Patel (2024EEA102)", status: "Full" },
              ].map((s, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{s.dept}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {s.sec}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-300 pt-2 border-t border-slate-850">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-cyan-400 font-bold">SEAT 1:</span>
                      <span className="truncate">{s.s1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-purple-400 font-bold">SEAT 2:</span>
                      <span className={s.s2.includes("Open") ? "text-amber-400 italic" : "truncate"}>
                        {s.s2}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Setup & Roster */}
        {activeTab === "setup" && <CollegeSetupForm />}

        {/* Tab 4: Responsible Handlers */}
        {activeTab === "handlers" && (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Incident Category to Responsible Group Mapping</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Authoritative routing policy from Revision 2 execution decisions.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-[11px] font-mono uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Responsible Group</th>
                    <th className="py-3 px-4">Default Verifier</th>
                    <th className="py-3 px-4">Safety Critical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {Object.entries(CATEGORY_HANDLER_MAP).map(([cat, info]) => (
                    <tr key={cat} className="hover:bg-slate-800/20">
                      <td className="py-3 px-4 font-medium text-white">{cat}</td>
                      <td className="py-3 px-4 text-cyan-300 font-mono">{info.responsibleGroup}</td>
                      <td className="py-3 px-4 text-slate-300">{info.defaultVerifier}</td>
                      <td className="py-3 px-4">
                        {info.isSafetyCritical ? (
                          <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800 text-[10px] font-semibold">
                            CRITICAL
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Standard</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

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
