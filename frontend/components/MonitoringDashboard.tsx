"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SystemStats {
  app_version: string;
  database: {
    available: boolean;
    total_analyses: number;
    total_documents: number;
    total_applications: number;
  };
  cache: {
    available: boolean;
    keyspace_hits: number;
    keyspace_misses: number;
    hit_rate: number;
  };
  storage: {
    backend: string;
    uploads_count: number;
    generated_count: number;
  };
}

interface HealthInfo {
  status: string;
  version: string;
  uptime_seconds: number;
  gemini_configured: boolean;
  database: boolean;
  cache: boolean;
  storage_backend: string;
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${on ? "bg-green-500" : "bg-gray-300"}`} />
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center space-x-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function MonitoringDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch(`${API}/api/system/stats`),
        fetch(`${API}/api/health`),
      ]);
      setStats(await statsRes.json());
      setHealth(await healthRes.json());
      setLastRefresh(new Date());
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000); // auto-refresh every 30 s
    return () => clearInterval(id);
  }, [fetchAll]);

  const formatUptime = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">System Monitor</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastRefresh ? `Last updated: ${lastRefresh.toLocaleTimeString()}` : "Loading…"}
            &nbsp;·&nbsp;auto-refreshes every 30s
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Refreshing…" : "Refresh Now"}
        </button>
      </div>

      {/* Service status bar */}
      {health && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex flex-wrap gap-5 text-sm">
            {[
              { label: "API",            on: health.status === "healthy" },
              { label: "Gemini AI",      on: health.gemini_configured },
              { label: "Database",       on: health.database },
              { label: "Redis Cache",    on: health.cache },
              { label: "Cloud Storage",  on: health.storage_backend !== "local", note: `(${health.storage_backend})` },
            ].map(({ label, on, note }) => (
              <div key={label} className="flex items-center space-x-2">
                <StatusDot on={on} />
                <span className={on ? "text-gray-800 font-medium" : "text-gray-400"}>
                  {label}
                  {note && <span className="ml-1 text-gray-400 font-normal">{note}</span>}
                </span>
              </div>
            ))}
            <div className="ml-auto text-gray-400">
              v{health.version} · uptime {formatUptime(health.uptime_seconds)}
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      {stats && (
        <>
          {/* Database */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Database&nbsp;
              <StatusDot on={stats.database.available} />
            </h3>
            {stats.database.available ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard icon="🔍" label="Total Analyses"    value={stats.database.total_analyses}    sub="Analysis sessions" />
                <StatCard icon="📄" label="Generated Documents" value={stats.database.total_documents}  sub="Resumes & cover letters" />
                <StatCard icon="📧" label="Applications Sent"   value={stats.database.total_applications} sub="Emails dispatched" />
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-5 text-center text-sm text-gray-500">
                Database offline — start with <code className="bg-gray-100 px-1 rounded">docker compose up</code>
                &nbsp;or set <code className="bg-gray-100 px-1 rounded">DATABASE_URL</code>
              </div>
            )}
          </section>

          {/* Cache */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Redis Cache&nbsp;
              <StatusDot on={stats.cache.available} />
            </h3>
            {stats.cache.available ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard icon="⚡" label="Cache Hits"   value={stats.cache.keyspace_hits}   sub="Gemini calls saved" />
                <StatCard icon="🔄" label="Cache Misses" value={stats.cache.keyspace_misses} sub="Fresh API calls made" />
                <StatCard
                  icon="📊"
                  label="Hit Rate"
                  value={`${stats.cache.hit_rate.toFixed(1)}%`}
                  sub={stats.cache.hit_rate >= 50 ? "Good — saving API costs" : "Warming up"}
                />
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-5 text-center text-sm text-gray-500">
                Redis offline — repeated uploads will re-call Gemini each time
              </div>
            )}
          </section>

          {/* Storage */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              File Storage
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={stats.storage.backend === "local" ? "💾" : stats.storage.backend === "s3" ? "☁️" : "🌐"}
                label="Backend"
                value={stats.storage.backend.toUpperCase()}
                sub={stats.storage.backend === "local" ? "Filesystem" : stats.storage.backend === "s3" ? "AWS S3" : "Google Cloud Storage"}
              />
              <StatCard icon="📁" label="Uploaded Files"   value={stats.storage.uploads_count}   sub="Resumes & job descriptions" />
              <StatCard icon="📂" label="Generated Files"  value={stats.storage.generated_count} sub="Tailored resumes & cover letters" />
            </div>
          </section>
        </>
      )}

      {/* Architecture note */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 text-sm text-indigo-800">
        <h4 className="font-semibold mb-2">Cloud Architecture</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-indigo-700">
          {[
            { icon: "🐳", label: "Docker Compose",  desc: "4 containerised services" },
            { icon: "🗄️",  label: "PostgreSQL",      desc: "Persistent analysis store" },
            { icon: "⚡",  label: "Redis Cache",     desc: "Saves AI API costs" },
            { icon: "☁️",  label: "Storage Layer",   desc: "Local · S3 · GCS" },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="bg-white/60 rounded-lg p-2 text-center">
              <div className="text-xl mb-1">{icon}</div>
              <div className="font-semibold">{label}</div>
              <div className="text-indigo-500 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
