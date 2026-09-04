'use client';

import React, { useState } from 'react';
import { INCIDENT_CATEGORIES, IncidentCategory, UPLOAD_LIMITS } from '@/contracts/reporting';

interface ReportFormProps {
  institutionId: string;
  memberId: string;
  onSuccess?: (result: ReportSuccess) => void;
  defaultScope?: 'student' | 'cr' | 'transport' | 'club';
}

interface ReportSuccess {
  incident: {
    id: string;
    state: string;
    category: string;
    clarificationRequest?: { question: string } | null;
  };
  emergencyContacts?: { campusSecurityPhone: string };
}

const CATEGORY_META: Record<
  IncidentCategory,
  { label: string; icon: string; description: string; color: string }
> = {
  classroom_infrastructure: {
    label: 'Classroom',
    icon: '📽️',
    description: 'Projectors, fans, benches, lighting, podium',
    color: 'bg-blue-50 border-blue-200 text-blue-800',
  },
  lab_equipment: {
    label: 'Lab Systems',
    icon: '💻',
    description: 'Workstations, network, multimeters, hardware',
    color: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  },
  washroom_hygiene: {
    label: 'Hygiene & Water',
    icon: '🚰',
    description: 'Plumbing, sanitizers, cleanliness, water coolers',
    color: 'bg-teal-50 border-teal-200 text-teal-800',
  },
  electrical_safety: {
    label: 'Electrical Risk',
    icon: '⚡',
    description: 'Sparks, exposed live wires, breaker trips',
    color: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  transport_route: {
    label: 'Campus Bus',
    icon: '🚌',
    description: 'Breakdown, driver delays, route deviation',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  club_facility: {
    label: 'Club & Events',
    icon: '🎭',
    description: 'Auditorium AV, seminar rooms, club spaces',
    color: 'bg-purple-50 border-purple-200 text-purple-800',
  },
  hostel_maintenance: {
    label: 'Hostel',
    icon: '🛏️',
    description: 'Room furniture, mess, laundry, hot water',
    color: 'bg-orange-50 border-orange-200 text-orange-800',
  },
  campus_emergency: {
    label: 'Emergency',
    icon: '🚨',
    description: 'Fire, hazard, immediate physical safety danger',
    color: 'bg-red-50 border-red-200 text-red-800',
  },
  confidential_complaint: {
    label: 'Confidential',
    icon: '🔒',
    description: 'Misconduct, ragging, harassment, grievance',
    color: 'bg-rose-50 border-rose-200 text-rose-800',
  },
  other: {
    label: 'Other',
    icon: '📋',
    description: 'General campus inquiry or unlisted concern',
    color: 'bg-gray-50 border-gray-200 text-gray-800',
  },
};

export default function ReportForm({
  institutionId,
  memberId,
  onSuccess,
  defaultScope = 'student',
}: ReportFormProps) {
  const [category, setCategory] = useState<IncidentCategory>('classroom_infrastructure');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [accusedId, setAccusedId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<ReportSuccess | null>(null);

  // Attachment previews
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);

    if (files.length + selected.length > UPLOAD_LIMITS.maxFilesPerReport) {
      setErrorMsg(`Maximum ${UPLOAD_LIMITS.maxFilesPerReport} photos allowed per report.`);
      return;
    }

    for (const f of selected) {
      if (f.size > UPLOAD_LIMITS.maxSizeBytes) {
        setErrorMsg(`File "${f.name}" exceeds 5MB limit.`);
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        setErrorMsg(`File "${f.name}" has invalid format. Only JPEG, PNG, or WebP allowed.`);
        return;
      }
    }

    setErrorMsg(null);
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const attachments = await Promise.all(files.map(async (file) => {
        const authorization = await fetch('/api/uploads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-orion-institution-id': institutionId,
            'x-orion-membership-id': memberId,
          },
          body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
        });
        const ticket = (await authorization.json()) as {
          data?: { uploadUrl: string; storageKey: string };
          error?: { message?: string };
        };
        if (!authorization.ok || !ticket.data) throw new Error(ticket.error?.message ?? 'Upload authorization failed');
        const upload = await fetch(ticket.data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!upload.ok) throw new Error(`Failed to upload ${file.name}`);
        return {
          storageKey: ticket.data.storageKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        };
      }));

      const payload = {
        description: description.trim(),
        locationText: locationText.trim(),
        categorySuggestion: category,
        category: isConfidential ? 'confidential_complaint' : category,
        visibility: isConfidential ? 'confidential' : 'routine',
        isConfidential,
        reportingScope: defaultScope,
        accusedMembershipId: isConfidential && accusedId ? accusedId.trim() : undefined,
        attachments,
      };

      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-orion-institution-id': institutionId,
          'x-orion-membership-id': memberId,
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        data?: ReportSuccess;
        error?: { message?: string };
      };

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to submit incident report');
      }

      if (!data.data) throw new Error('Server returned an incomplete incident response');
      setSuccessInfo(data.data);
      setDescription('');
      setLocationText('');
      setFiles([]);
      if (onSuccess) onSuccess(data.data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successInfo) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-emerald-200">
        <div className="flex items-center gap-3 text-emerald-600 mb-4">
          <span className="text-3xl">✅</span>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Incident Reported Successfully</h3>
            <p className="text-sm text-gray-600">
              Reference ID: <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">{successInfo.incident.id}</code>
            </p>
          </div>
        </div>

        <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
          <p>
            <strong>Status:</strong> <span className="uppercase font-semibold text-indigo-600">{successInfo.incident.state}</span>
          </p>
          <p>
            <strong>Triage Classification:</strong> {successInfo.incident.category}
          </p>
          {successInfo.incident.clarificationRequest && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900">
              ⚠️ <strong>Clarification Required:</strong> {successInfo.incident.clarificationRequest.question}
            </div>
          )}
          {successInfo.emergencyContacts && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-900">
              <strong>Official Campus Emergency Hotline:</strong> {successInfo.emergencyContacts.campusSecurityPhone}
            </div>
          )}
        </div>

        <button
          onClick={() => setSuccessInfo(null)}
          className="mt-6 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition"
        >
          Submit Another Report
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Report Campus Issue</h2>
        <p className="text-sm text-gray-500 mt-1">
          Submit equipment faults, facility maintenance, safety hazards, or confidential concerns.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Confidential / Safety Toggle */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3">
        <input
          type="checkbox"
          id="confidential-toggle"
          checked={isConfidential}
          onChange={(e) => {
            setIsConfidential(e.target.checked);
            if (e.target.checked) setCategory('confidential_complaint');
          }}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="confidential-toggle" className="text-sm cursor-pointer">
          <span className="font-semibold text-gray-900 block">🔒 Private & Confidential Intake</span>
          <span className="text-gray-500 text-xs block mt-0.5">
            Routes directly to Administration / ICC Grievance Committee. Bypasses Class Representatives and is strictly hidden from public issue feeds and student voting.
          </span>
        </label>
      </div>

      {isConfidential && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Accused Staff / CR (Optional - Automatically Excluded from Case Access)
          </label>
          <input
            type="text"
            value={accusedId}
            onChange={(e) => setAccusedId(e.target.value)}
            placeholder="Name or Membership ID of accused party"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      )}

      {/* Category selector */}
      {!isConfidential && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Issue Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {INCIDENT_CATEGORIES.filter((c) => c !== 'confidential_complaint').map((cat) => {
              const meta = CATEGORY_META[cat];
              const isSelected = category === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`p-3 text-left rounded-lg border transition text-xs flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="text-lg mb-1">{meta.icon}</div>
                  <div className="font-semibold text-gray-900">{meta.label}</div>
                  <div className="text-gray-500 text-[10px] line-clamp-1 mt-0.5">{meta.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Exact Location <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder="e.g. Room 302, 3rd Floor, CS Block or Electronics Lab B"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <p className="text-[11px] text-gray-500 mt-1">
          Tip: Include specific room or lab number to avoid automatic clarification delays.
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description of Issue <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue, symptoms, and impact on students or lectures..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
        />
        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
          <span>Treated as untrusted data by AI orchestrator</span>
          <span>{description.length} / 2000</span>
        </div>
      </div>

      {/* Photos dropzone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Evidence Photos (Optional, max 3 files, 5MB each)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={files.length >= UPLOAD_LIMITS.maxFilesPerReport}
          onChange={handleFileChange}
          className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
        />
        {files.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded text-xs text-gray-700 border border-gray-200"
              >
                <span className="truncate max-w-[140px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-red-500 hover:text-red-700 ml-1 font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || description.length < 10 || locationText.length < 2}
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-sm transition flex justify-center items-center gap-2 text-sm"
      >
        {isSubmitting ? (
          <span>Analyzing & Submitting...</span>
        ) : (
          <span>Submit Incident to ORION</span>
        )}
      </button>
    </form>
  );
}
