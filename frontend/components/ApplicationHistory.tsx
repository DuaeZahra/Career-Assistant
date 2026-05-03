"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface HistoryItem {
  id: string;
  created_at: string | null;
  resume_filename: string | null;
  job_filename: string | null;
  match_percentage: number | null;
  from_cache: boolean;
  job_title: string | null;
  company_name: string | null;
}

interface DetailedItem extends HistoryItem {
  job_analysis: Record<string, unknown>;
  resume_analysis: Record<string, unknown>;
  skill_gap: {
    matching_skills: string[];
    missing_skills: string[];
    partial_skills: string[];
  };
}

function MatchBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400 text-sm">—</span>;
  const color =
    pct >= 75 ? "bg-green-100 text-green-800" :
    pct >= 50 ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

export default function ApplicationHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [selected, setSelected] = useState<DetailedItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/history`);
      const data = await res.json();
      setAvailable(!!data.available);
      setItems(data.items || []);
    } catch {
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/api/history/${id}`);
      const data = await res.json();
      setSelected(data as DetailedItem);
    } catch {
      /* ignore */
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!available) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <div className="text-amber-600 text-4xl mb-3">🗄️</div>
        <h3 className="text-lg font-semibold text-amber-800 mb-1">Database not connected</h3>
        <p className="text-amber-700 text-sm">
          Run with Docker Compose to enable persistent history, or set{" "}
          <code className="bg-amber-100 px-1 rounded">DATABASE_URL</code> in your{" "}
          <code className="bg-amber-100 px-1 rounded">.env</code>.
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-lg font-medium">No analyses yet</p>
        <p className="text-sm mt-1">Upload your resume and a job description to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Analysis History</h2>
        <button
          onClick={fetchHistory}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 bg-white">
          <thead className="bg-gray-50">
            <tr>
              {["Date", "Job Title", "Company", "Resume", "Match", "Cached", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[160px] truncate">
                  {item.job_title || "Unknown"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px] truncate">
                  {item.company_name || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[140px] truncate">
                  {item.resume_filename || "—"}
                </td>
                <td className="px-4 py-3">
                  <MatchBadge pct={item.match_percentage} />
                </td>
                <td className="px-4 py-3 text-center">
                  {item.from_cache ? (
                    <span title="Served from Redis cache" className="text-blue-500 text-xs font-semibold">⚡ Cached</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openDetail(item.id)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Details →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {(selected.job_analysis as any)?.job_title || "Analysis Detail"}
              </h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium uppercase mb-1">Match</div>
                <MatchBadge pct={selected.match_percentage} />
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 font-medium uppercase mb-1">Date</div>
                <div className="text-gray-800">{selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</div>
              </div>
            </div>

            {selected.skill_gap && (
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-700">Skill Gap</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <SkillGroup label="Matching" skills={selected.skill_gap.matching_skills} color="green" />
                  <SkillGroup label="Partial" skills={selected.skill_gap.partial_skills} color="yellow" />
                  <SkillGroup label="Missing" skills={selected.skill_gap.missing_skills} color="red" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {detailLoading && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      )}
    </div>
  );
}

function SkillGroup({ label, skills, color }: { label: string; skills: string[]; color: "green" | "yellow" | "red" }) {
  const colors = {
    green:  "bg-green-50  border-green-200  text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red:    "bg-red-50    border-red-200    text-red-700",
  };
  return (
    <div className={`rounded-lg border p-2 ${colors[color]}`}>
      <div className="font-semibold mb-1">{label} ({skills.length})</div>
      <ul className="space-y-0.5">
        {skills.slice(0, 5).map(s => <li key={s} className="truncate">{s}</li>)}
        {skills.length > 5 && <li className="opacity-60">+{skills.length - 5} more</li>}
      </ul>
    </div>
  );
}
