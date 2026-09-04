"use client";

import React, { useState } from "react";
import { MemberItem } from "../identity/MembershipList";
import { RoleEnum } from "@/contracts/identity";

interface RoleGrantModalProps {
  member: MemberItem;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RoleGrantModal({ member, onClose, onSuccess }: RoleGrantModalProps) {
  const [role, setRole] = useState<RoleEnum>("cr");
  const [departmentId, setDepartmentId] = useState("dept-cs-01");
  const [section, setSection] = useState("A");
  const [seatNumber, setSeatNumber] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Revoke state
  const [revokeReason, setRevokeReason] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/role-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          granted_by_membership_id: "mem-01", // Demo principal/admin session
          membership_id: member.id,
          role,
          department_id: role === "cr" || role === "hod" ? departmentId : undefined,
          section: role === "cr" ? section : undefined,
          seat_number: role === "cr" ? seatNumber : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to grant role.");
      }

      setSuccessMsg(`Successfully granted '${role}' role to ${member.name}!`);
      if (onSuccess) onSuccess();
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to grant role.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-white">Manage Authorization Roles</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Assign or revoke roles for <span className="text-cyan-400 font-medium">{member.name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleGrant} className="mt-5 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1.5">Select Role to Grant</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleEnum)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="cr">Class Representative (CR)</option>
              <option value="hod">Head of Department (HOD)</option>
              <option value="staff">Staff / Facilities Specialist</option>
              <option value="admin">College Administrator</option>
              <option value="transport_admin">Transport Admin</option>
              <option value="club_president">Club President</option>
            </select>
          </div>

          {/* CR Specific 2-Seat Constraint Inputs */}
          {role === "cr" && (
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="text-[11px] font-mono uppercase text-cyan-400 font-semibold">
                Two-Seat Section Constraint
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  >
                    <option value="dept-cs-01">Computer Science</option>
                    <option value="dept-ee-01">Electrical Engg</option>
                    <option value="dept-me-01">Mechanical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Section</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Seat Number</label>
                  <select
                    value={seatNumber}
                    onChange={(e) => setSeatNumber(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold"
                  >
                    <option value={1}>Seat 1</option>
                    <option value={2}>Seat 2</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Max 2 concurrently occupied CR seats per section. Unique active seat constraints prevent duplicate appointments.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
            >
              {loading ? "Granting..." : "Confirm Role Grant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
