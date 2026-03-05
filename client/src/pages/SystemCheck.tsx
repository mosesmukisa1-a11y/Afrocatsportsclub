import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { CheckCircle2, XCircle, Loader2, Server, Database, Shield, RefreshCw } from "lucide-react";

interface ModuleResult {
  name: string;
  label: string;
  status: "pending" | "pass" | "fail";
  error?: string;
}

interface EnvVar {
  key: string;
  configured: boolean;
}

const MODULE_LABELS: Record<string, string> = {
  teams: "Teams",
  players: "Players",
  matches: "Matches",
  media: "Media",
  financeFeeConfig: "Finance Fee Config",
  notifications: "Notifications",
  chatRooms: "Chat Rooms",
  notices: "Notices",
};

function StatusIcon({ status }: { status: "pending" | "pass" | "fail" }) {
  if (status === "pending") return <Loader2 size={20} className="animate-spin text-afrocat-muted" />;
  if (status === "pass") return <CheckCircle2 size={20} className="text-green-500" />;
  return <XCircle size={20} className="text-red-500" />;
}

export default function SystemCheck() {
  const [modules, setModules] = useState<ModuleResult[]>(
    Object.entries(MODULE_LABELS).map(([name, label]) => ({ name, label, status: "pending" }))
  );
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [envLoading, setEnvLoading] = useState(true);
  const [envError, setEnvError] = useState("");
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [serverTime, setServerTime] = useState("");
  const [running, setRunning] = useState(false);

  const runAllChecks = async () => {
    setRunning(true);
    setModules(Object.entries(MODULE_LABELS).map(([name, label]) => ({ name, label, status: "pending" })));
    setEnvVars([]);
    setEnvLoading(true);
    setEnvError("");
    setServerOk(null);
    setServerTime("");

    try {
      const healthRes = await fetch("/api/health");
      const healthData = await healthRes.json();
      setServerOk(healthData.ok === true);
      setServerTime(healthData.time || "");
    } catch {
      setServerOk(false);
    }

    try {
      const modRes = await fetch("/api/health/modules");
      const modData = await modRes.json();
      if (modData.modules) {
        setModules(
          Object.entries(MODULE_LABELS).map(([name, label]) => ({
            name,
            label,
            status: modData.modules[name] === true ? "pass" : "fail",
            error: modData.errors?.[name],
          }))
        );
      } else {
        setModules(prev => prev.map(m => ({ ...m, status: "fail" })));
      }
    } catch {
      setModules(prev => prev.map(m => ({ ...m, status: "fail", error: "Could not reach health endpoint" })));
    }

    try {
      const envRes = await fetch("/api/health/env");
      const envData = await envRes.json();
      if (envData.env) {
        setEnvVars(Object.entries(envData.env).map(([key, configured]) => ({ key, configured: configured as boolean })));
        if (envData.error) setEnvError(envData.error);
      } else {
        setEnvError("Unexpected response from environment check");
      }
    } catch {
      setEnvError("Failed to reach environment check endpoint");
    }
    setEnvLoading(false);
    setRunning(false);
  };

  useEffect(() => { runAllChecks(); }, []);

  const passCount = modules.filter(c => c.status === "pass").length;
  const failCount = modules.filter(c => c.status === "fail").length;
  const pendingCount = modules.filter(c => c.status === "pending").length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-system-check-title">System Check</h1>
            <p className="text-afrocat-muted text-sm mt-1">Health status of all system modules and environment configuration</p>
          </div>
          <button
            onClick={runAllChecks}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 transition-all disabled:opacity-50 cursor-pointer"
            data-testid="button-rerun-checks"
          >
            <RefreshCw size={16} className={running ? "animate-spin" : ""} />
            {running ? "Checking..." : "Re-run Checks"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-afrocat-card border border-afrocat-border rounded-lg p-4 flex items-center gap-3" data-testid="card-server-status">
            {serverOk === null ? (
              <Loader2 size={24} className="animate-spin text-afrocat-muted" />
            ) : serverOk ? (
              <CheckCircle2 size={24} className="text-green-500" />
            ) : (
              <XCircle size={24} className="text-red-500" />
            )}
            <div>
              <p className="text-sm font-bold text-afrocat-text">Server</p>
              <p className="text-[10px] text-afrocat-muted">{serverOk ? "Online" : serverOk === false ? "Offline" : "Checking..."}</p>
              {serverTime && <p className="text-[10px] text-afrocat-muted font-mono">{new Date(serverTime).toLocaleTimeString()}</p>}
            </div>
          </div>
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
            <h2 className="font-semibold text-afrocat-text">Module Health Checks</h2>
            <span className="ml-auto text-[10px] text-afrocat-muted font-mono">via /api/health/modules</span>
          </div>
          <div className="divide-y divide-afrocat-border">
            {modules.map((mod) => (
              <div key={mod.name} className="flex items-center justify-between px-4 py-3" data-testid={`check-${mod.name}`}>
                <div>
                  <span className="text-sm text-afrocat-text">{mod.label}</span>
                  {mod.error && <p className="text-[10px] text-red-400 mt-0.5">{mod.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${mod.status === "pass" ? "text-green-500" : mod.status === "fail" ? "text-red-500" : "text-afrocat-muted"}`}>
                    {mod.status === "pass" ? "PASS" : mod.status === "fail" ? "FAIL" : "CHECKING"}
                  </span>
                  <StatusIcon status={mod.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-afrocat-card border border-afrocat-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-afrocat-border flex items-center gap-2">
            <Shield size={18} className="text-afrocat-teal" />
            <h2 className="font-semibold text-afrocat-text">Environment Configuration</h2>
            <span className="ml-auto text-[10px] text-afrocat-muted font-mono">via /api/health/env</span>
          </div>
          <div className="divide-y divide-afrocat-border">
            {envLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-afrocat-muted" />
                <span className="ml-2 text-sm text-afrocat-muted">Checking environment...</span>
              </div>
            ) : envVars.length === 0 && envError ? (
              <div className="flex items-center justify-center py-6 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <XCircle size={20} className="text-red-500" />
                  <span className="text-sm text-red-500">{envError}</span>
                </div>
              </div>
            ) : (
              <>
                {envError && (
                  <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
                    <p className="text-xs text-red-400">{envError}</p>
                  </div>
                )}
                {envVars.map(({ key, configured }) => (
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
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
