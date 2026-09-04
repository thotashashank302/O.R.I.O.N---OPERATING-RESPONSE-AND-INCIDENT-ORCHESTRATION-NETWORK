"use client";

import React, { useState } from "react";

export function CollegeSetupForm() {
  const [activeTab, setActiveTab] = useState<"college" | "department" | "location" | "roster">("college");

  // College form state
  const [collegeName, setCollegeName] = useState("ORION Institute of Technology");
  const [collegeCode, setCollegeCode] = useState("ORION-DEMO");
  const [collegeStatus, setCollegeStatus] = useState<string | null>(null);

  // Location form state
  const [locationLabel, setLocationLabel] = useState("Lab 402 - Systems Lab");
  const [locationKind, setLocationKind] = useState("lab");
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Roster row state
  const [rosterRoll, setRosterRoll] = useState("2024CSB105");
  const [rosterEmail, setRosterEmail] = useState("ananya.k@orion.edu");
  const [rosterYear, setRosterYear] = useState(2);
  const [rosterSec, setRosterSec] = useState("A");
  const [rosterStatus, setRosterStatus] = useState<string | null>(null);

  const handleCreateCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    setCollegeStatus("Submitting...");
    try {
      const res = await fetch("/api/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: collegeName, code: collegeCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Creation failed");
      setCollegeStatus(`Success! College created with ID: ${json.data.id}`);
    } catch (err: unknown) {
      setCollegeStatus(
        `Error: ${err instanceof Error ? err.message : "Creation failed"}`
      );
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocationStatus("Adding location...");
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution_id: "demo-inst-01",
          label: locationLabel,
          kind: locationKind,
          asset_counts: { workstations: 30, projector: 1, ac_units: 2 },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Location creation failed");
      setLocationStatus(`Success! Location '${locationLabel}' added.`);
    } catch (err: unknown) {
      setLocationStatus(
        `Error: ${err instanceof Error ? err.message : "Location creation failed"}`
      );
    }
  };

  const handleAddRosterRow = async (e: React.FormEvent) => {
    e.preventDefault();
    setRosterStatus("Adding student to roster...");
    try {
      const res = await fetch("/api/roster/rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution_id: "demo-inst-01",
          roll_number: rosterRoll,
          roster_email: rosterEmail,
          department_id: "dept-cs-01",
          year: Number(rosterYear),
          section: rosterSec,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Roster row addition failed");
      setRosterStatus(`Success! Added ${rosterRoll} (${rosterEmail}) to roster.`);
    } catch (err: unknown) {
      setRosterStatus(
        `Error: ${err instanceof Error ? err.message : "Roster row addition failed"}`
      );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl p-6 shadow-xl text-slate-200">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-white">Campus Infrastructure & Roster Configuration</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure institutions, department mappings, physical buildings, and official roster data.
          </p>
        </div>
        {/* Navigation Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab("college")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "college" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
            }`}
          >
            Institution
          </button>
          <button
            onClick={() => setActiveTab("location")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "location" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
            }`}
          >
            Locations
          </button>
          <button
            onClick={() => setActiveTab("roster")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "roster" ? "bg-cyan-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
            }`}
          >
            Manual Roster
          </button>
        </div>
      </div>

      <div className="mt-6 text-xs">
        {/* Tab 1: Institution */}
        {activeTab === "college" && (
          <form onSubmit={handleCreateCollege} className="max-w-xl space-y-4">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Institution Full Name</label>
              <input
                type="text"
                required
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Unique College Code</label>
              <input
                type="text"
                required
                value={collegeCode}
                onChange={(e) => setCollegeCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg transition-all"
            >
              Create Institution
            </button>
            {collegeStatus && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[11px]">
                {collegeStatus}
              </div>
            )}
          </form>
        )}

        {/* Tab 2: Locations */}
        {activeTab === "location" && (
          <form onSubmit={handleCreateLocation} className="max-w-xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Location Kind</label>
                <select
                  value={locationKind}
                  onChange={(e) => setLocationKind(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="block">Academic Block</option>
                  <option value="floor">Floor</option>
                  <option value="room">Classroom</option>
                  <option value="lab">Laboratory</option>
                  <option value="facility">Facility (Mess/Sports)</option>
                  <option value="outdoor">Outdoor / Zone</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Label / Room Identifier</label>
                <input
                  type="text"
                  required
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder="e.g. Room 301 / Circuit Lab"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg transition-all"
            >
              Add Campus Location
            </button>
            {locationStatus && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[11px]">
                {locationStatus}
              </div>
            )}
          </form>
        )}

        {/* Tab 3: Manual Roster Entry */}
        {activeTab === "roster" && (
          <form onSubmit={handleAddRosterRow} className="max-w-xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Roll Number</label>
                <input
                  type="text"
                  required
                  value={rosterRoll}
                  onChange={(e) => setRosterRoll(e.target.value.toUpperCase())}
                  placeholder="e.g. 2024CSB105"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Official Student Email</label>
                <input
                  type="email"
                  required
                  value={rosterEmail}
                  onChange={(e) => setRosterEmail(e.target.value)}
                  placeholder="student@orion.edu"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Academic Year</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={rosterYear}
                  onChange={(e) => setRosterYear(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Section</label>
                <input
                  type="text"
                  value={rosterSec}
                  onChange={(e) => setRosterSec(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg transition-all"
            >
              Add Student to Roster
            </button>
            {rosterStatus && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[11px]">
                {rosterStatus}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
