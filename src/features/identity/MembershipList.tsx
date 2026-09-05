"use client";

import React, { useState, useEffect } from "react";
import { orionContextHeaders, useActiveContext } from "./use-active-context";

export interface MemberItem {
  id: string;
  name: string;
  email: string;
  rollNumber?: string;
  department?: string;
  section?: string;
  roles: string[];
  status: "active" | "inactive";
}

interface MembershipListProps {
  members?: MemberItem[];
  onToggleStatus?: (id: string, newStatus: "active" | "inactive") => void;
  onOpenRoleModal?: (member: MemberItem) => void;
}

export function MembershipList({
  members: initialMembers,
  onToggleStatus,
  onOpenRoleModal,
}: MembershipListProps) {
  const { activeContext } = useActiveContext();
  const [members, setMembers] = useState<MemberItem[]>(initialMembers ?? []);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (initialMembers) return;
    let cancelled = false;
    async function loadMembers() {
      try {
        const res = await fetch("/api/memberships", {
          headers: activeContext ? orionContextHeaders(activeContext) : {},
        });
        const json = await res.json();
        if (!cancelled && json.data) {
          setMembers(json.data);
        }
      } catch (err) {
        console.error("Failed to load members:", err);
      }
    }
    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [initialMembers, activeContext]);

  const handleToggle = async (id: string, currentStatus: "active" | "inactive") => {
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    setActionError(null);

    // Optimistic UI
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: nextStatus } : m))
    );

    try {
      const response = await fetch(`/api/memberships/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(activeContext ? orionContextHeaders(activeContext) : {}) },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Membership status could not be updated.");
      }
      if (onToggleStatus) onToggleStatus(id, nextStatus);
    } catch (error) {
      // Rollback on error
      setMembers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: currentStatus } : m))
      );
      setActionError(error instanceof Error ? error.message : "Membership status could not be updated.");
    }
  };

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
      m.roles.some((r) => r.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-xl">
      {actionError ? <p role="alert" className="m-4 rounded-lg border border-red-700 bg-red-950/60 p-3 text-xs text-red-200">{actionError}</p> : null}
      <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Campus Membership & Roles</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage verified personnel, students, and active authorization status.
          </p>
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member, email, roll..."
            className="px-3.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/40 text-[11px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
            <tr>
              <th className="py-3.5 px-4 font-medium">Member</th>
              <th className="py-3.5 px-4 font-medium">Scope</th>
              <th className="py-3.5 px-4 font-medium">Active Roles</th>
              <th className="py-3.5 px-4 font-medium">Account Status</th>
              <th className="py-3.5 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.map((member) => (
              <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-medium text-white">{member.name}</div>
                  <div className="text-[11px] text-slate-400">{member.email}</div>
                  {member.rollNumber && (
                    <span className="font-mono text-[10px] text-cyan-400">
                      Roll: {member.rollNumber}
                    </span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-slate-400">
                  {member.department ? (
                    <div>
                      <div className="text-slate-200">{member.department}</div>
                      {member.section && <div>Sec: {member.section}</div>}
                    </div>
                  ) : (
                    <span className="text-slate-500">Institution-wide</span>
                  )}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex flex-wrap gap-1.5">
                    {member.roles.map((role, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                      member.status === "active"
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                        : "bg-red-950/80 text-red-300 border border-red-800/60"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        member.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                      }`}
                    />
                    {member.status}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleToggle(member.id, member.status)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
                        member.status === "active"
                          ? "bg-red-950/40 hover:bg-red-900/60 text-red-300 border-red-800/60"
                          : "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/60"
                      }`}
                    >
                      {member.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    {onOpenRoleModal && (
                      <button
                        onClick={() => onOpenRoleModal(member)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                      >
                        Manage Roles
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
