import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { CheckCircle2, XCircle, Loader2, Server, Database, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CheckResult {
  label: string;
  status: "pending" | "pass" | "fail";
}

interface EnvCheckResult {
  GMAIL_USER: boolean;
  GMAIL_APP_PASSWORD: boolean;
  EMAIL_AUTO_CC: boolean;
  DATABASE_URL: boolean;
}

const API_CHECKS = [
  { label: "Teams", url: "/api/teams" },
  { label: "Players", url: "/api/players" },
  { label: "Matches", url: "/api/matches" },
  { label: "Media", url: "/api/media" },
  { label: "Finance Fee Config", url: "/api/finance/fee-config" },
  { label: "Notifications", url: "/api/notifications" },
  { label: "Chat Rooms", url: "/api/chat/rooms" },
  { label: "Notices", url: "/api/notices" },
];

function StatusIcon({ status }: { status: "pending" | "pass" | "fail" }) {
  if (status === "pending") return <Loader2 size={20} className="animate-spin text-afrocat-muted" />;
  if (status === "pass") return <CheckCircle2 size={20} className="text-green-500" />;
  return <XCircle size={20} className="text-red-500" />;
}

export default function SystemCheck() {
  const [checks, setChecks] = useState<CheckResult[]>(
    API_CHECKS.map(c => ({ label: c.label, status: "pending" }))
  );
  const [envCheck, setEnvCheck] = useState<EnvCheckResult | null>(null);
  const [envLoading, setEnvLoading] = useState(true);
  const [envError, setEnvError] = useState(false);

  useEffect(() => {
    async function runChecks() {
      for (let i = 0; i < API_CHECKS.length; i++) {
        try {
          await apiRequest("GET", API_CHECKS[i].url);
          setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: "pass" } : c));
        } catch {
          setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: "fail" } : c));
        }
      }
    }

    async function runEnvCheck() {
      try {
        const res = await apiRequest("GET", "/api/admin/env-check");
        const data = await res.json();
        setEnvCheck(data);
      } catch {
        setEnvError(true);
      } finally {
        setEnvLoading(false);
      }
    }

    runChecks();
    runEnvCheck();
  }, []);

  const passCount = checks.filter(c => c.status === "pass").length;
  const failCount = checks.filter(c => c.status === "fail").length;
  const pendingCount = checks.filter(c => c.status === "pending").length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-system-check-title">System Check</h1>
          <p className="text-afrocat-muted text-sm mt-1">Health status of all system modules and environment configuration</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-afrocat-card border border-afrocat-border rounded-lg p-4 flex items-center gap-3" data-testid="card-pass-count">
            <CheckCircle2 size={24} className="text-green-500" />
            <div>
              <p className="text-2xl font-bold text-afrocat-text">{passCount}</p>
              <p className="text-xs text-afrocat-muted">Passed</p>
            </div>
          </div>
          <div className="bg-afrocat-card border border-afrocat-border rounded-lg p-4 flex items-center gap-3" data-testid="card-fail-count">
            <XCircle size={24} className="text-red-500" />
            <div>
              <p className="text-2xl font-bold text-afrocat-text">{failCount}</p>
              <p className="text-xs text-afrocat-muted">Failed</p>
            </div>
          </div>
          <div className="bg-afrocat-card border border-afrocat-border rounded-lg p-4 flex items-center gap-3" data-testid="card-pending-count">
            <Loader2 size={24} className={`text-afrocat-muted ${pendingCount > 0 ? "animate-spin" : ""}`} />
            <div>
              <p className="text-2xl font-bold text-afrocat-text">{pendingCount}</p>
              <p className="text-xs text-afrocat-muted">Checking</p>
            </div>
          </div>
        </div>

        <div className="bg-afrocat-card border border-afrocat-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-afrocat-border flex items-center gap-2">
            <Server size={18} className="text-afrocat-teal" />
            <h2 className="font-semibold text-afrocat-text">API Health Checks</h2>
          </div>
          <div className="divide-y divide-afrocat-border">
            {checks.map((check) => (
              <div key={check.label} className="flex items-center justify-between px-4 py-3" data-testid={`check-${check.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <span className="text-sm text-afrocat-text">{check.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${check.status === "pass" ? "text-green-500" : check.status === "fail" ? "text-red-500" : "text-afrocat-muted"}`}>
                    {check.status === "pass" ? "PASS" : check.status === "fail" ? "FAIL" : "CHECKING"}
                  </span>
                  <StatusIcon status={check.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-afrocat-card border border-afrocat-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-afrocat-border flex items-center gap-2">
            <Shield size={18} className="text-afrocat-teal" />
            <h2 className="font-semibold text-afrocat-text">Environment Configuration</h2>
          </div>
          <div className="divide-y divide-afrocat-border">
            {envLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-afrocat-muted" />
                <span className="ml-2 text-sm text-afrocat-muted">Checking environment...</span>
              </div>
            ) : envError ? (
              <div className="flex items-center justify-center py-6">
                <XCircle size={20} className="text-red-500" />
                <span className="ml-2 text-sm text-red-500">Failed to check environment variables</span>
              </div>
            ) : envCheck ? (
              Object.entries(envCheck).map(([key, configured]) => (
                <div key={key} className="flex items-center justify-between px-4 py-3" data-testid={`env-${key.toLowerCase().replace(/_/g, "-")}`}>
                  <div className="flex items-center gap-2">
                    <Database size={14} className="text-afrocat-muted" />
                    <span className="text-sm text-afrocat-text font-mono">{key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${configured ? "text-green-500" : "text-red-500"}`}>
                      {configured ? "CONFIGURED" : "NOT SET"}
                    </span>
                    {configured ? <CheckCircle2 size={18} className="text-green-500" /> : <XCircle size={18} className="text-red-500" />}
                  </div>
                </div>
              ))
            ) : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}