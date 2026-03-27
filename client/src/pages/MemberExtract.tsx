import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import {
  Download, Search, Printer, CheckSquare, Square, ChevronDown, ChevronUp,
  Filter, Users, X, Eye, FileText, LayoutList, Table2
} from "lucide-react";

const ALL_FIELDS: { key: string; label: string; group: string }[] = [
  { key: "fullName", label: "Full Name", group: "Basic" },
  { key: "email", label: "Email Address", group: "Basic" },
  { key: "phone", label: "Phone Number", group: "Basic" },
  { key: "role", label: "Club Role", group: "Basic" },
  { key: "teamName", label: "Team", group: "Basic" },
  { key: "accountStatus", label: "Account Status", group: "Basic" },
  { key: "gender", label: "Gender", group: "Basic" },

  { key: "dob", label: "Date of Birth", group: "Personal" },
  { key: "nationality", label: "Nationality", group: "Personal" },
  { key: "idNumber", label: "ID Number", group: "Personal" },
  { key: "homeAddress", label: "Home Address", group: "Personal" },
  { key: "town", label: "Town", group: "Personal" },
  { key: "region", label: "Region", group: "Personal" },

  { key: "position", label: "Position", group: "Player" },
  { key: "jerseyNo", label: "Jersey Number", group: "Player" },
  { key: "playerStatus", label: "Player Status", group: "Player" },
  { key: "eligibilityStatus", label: "Eligibility", group: "Player" },

  { key: "heightCm", label: "Height (cm)", group: "Physical" },
  { key: "weightKg", label: "Weight (kg)", group: "Physical" },
  { key: "bloodGroup", label: "Blood Group", group: "Physical" },
  { key: "allergies", label: "Allergies", group: "Physical" },
  { key: "medicalNotes", label: "Medical Notes", group: "Physical" },

  { key: "nextOfKinName", label: "Next of Kin Name", group: "Next of Kin" },
  { key: "nextOfKinRelation", label: "Next of Kin Relation", group: "Next of Kin" },
  { key: "nextOfKinPhone", label: "Next of Kin Phone", group: "Next of Kin" },
  { key: "nextOfKinAddress", label: "Next of Kin Address", group: "Next of Kin" },

  { key: "emergencyContactName", label: "Emergency Contact Name", group: "Emergency" },
  { key: "emergencyContactPhone", label: "Emergency Contact Phone", group: "Emergency" },
];

const GROUPS = [...new Set(ALL_FIELDS.map(f => f.group))];

const DEFAULT_FIELDS = ["fullName", "email", "phone", "teamName", "role", "gender", "dob", "position"];

function ageFromDob(dob: string) {
  if (!dob) return "";
  try {
    const b = new Date(dob);
    const age = Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
    return isNaN(age) ? "" : `${age} yrs`;
  } catch { return ""; }
}

function formatVal(key: string, val: any) {
  if (val === null || val === undefined || val === "") return "—";
  if (key === "dob") return val + (val ? ` (${ageFromDob(val)})` : "");
  if (key === "heightCm") return `${val} cm`;
  if (key === "weightKg") return `${val} kg`;
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

export default function MemberExtract() {
  const [searchQ, setSearchQ] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_FIELDS));
  const [showPreview, setShowPreview] = useState(false);
  const [viewLayout, setViewLayout] = useState<"cards" | "table">("table");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(GROUPS));
  const printRef = useRef<HTMLDivElement>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["/api/admin/member-extract", searchQ, filterRole, filterTeam, filterGender, filterStatus],
    queryFn: () => api.getMemberExtract({ q: searchQ, role: filterRole, teamId: filterTeam, gender: filterGender, status: filterStatus }),
    staleTime: 30000,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: api.getTeams,
  });

  const displayMembers = useMemo(() => {
    const all = members as any[];
    if (selectedIds.size === 0) return all;
    return all.filter((m: any) => selectedIds.has(m.id));
  }, [members, selectedIds]);

  const orderedFields = useMemo(() =>
    ALL_FIELDS.filter(f => selectedFields.has(f.key)),
    [selectedFields]
  );

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === (members as any[]).length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((members as any[]).map((m: any) => m.id)));
    }
  };

  const toggleField = (key: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const groupFields = ALL_FIELDS.filter(f => f.group === group).map(f => f.key);
    const allSelected = groupFields.every(k => selectedFields.has(k));
    setSelectedFields(prev => {
      const next = new Set(prev);
      groupFields.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const toggleGroupOpen = (group: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  };

  const handlePrint = () => {
    setShowPreview(true);
    setTimeout(() => window.print(), 400);
  };

  const memberList = members as any[];
  const allSelected = selectedIds.size === memberList.length && memberList.length > 0;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const printTarget = selectedIds.size > 0
    ? memberList.filter((m: any) => selectedIds.has(m.id))
    : memberList;

  return (
    <Layout>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #member-print-area, #member-print-area * { visibility: visible !important; }
          #member-print-area { position: fixed; top: 0; left: 0; width: 100%; z-index: 9999; background: white !important; color: black !important; padding: 20px; }
          #member-print-area table { border-collapse: collapse; width: 100%; font-size: 10px; }
          #member-print-area th, #member-print-area td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
          #member-print-area th { background: #1a1a2e !important; color: white !important; }
          #member-print-area .print-card { border: 1px solid #ccc; padding: 8px; margin-bottom: 8px; break-inside: avoid; }
        }
      `}</style>

      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-7 w-7 text-afrocat-gold" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-extract-title">Member Data Extract</h1>
              <p className="text-xs text-afrocat-muted">Select members and fields, then preview or print</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-afrocat-text font-bold text-sm cursor-pointer hover:border-afrocat-gold transition-colors"
              data-testid="button-toggle-preview">
              <Eye size={16} /> {showPreview ? "Hide Preview" : "Preview"}
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-gold text-afrocat-bg font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity"
              data-testid="button-print">
              <Printer size={16} /> Print / PDF
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-5">
          <div className="space-y-4">
            <div className="afrocat-card p-4 space-y-3">
              <p className="text-xs font-bold text-afrocat-gold uppercase tracking-wider flex items-center gap-2"><Filter size={12} /> Filter Members</p>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-afrocat-muted" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search name, email, ID..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm"
                  data-testid="input-extract-search" />
              </div>
              <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-extract-team">
                <option value="">All Teams</option>
                {(teams as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-extract-gender">
                  <option value="">Any Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-extract-role">
                  <option value="">All Roles</option>
                  {["PLAYER","COACH","MANAGER","ADMIN","MEDICAL","FINANCE","STATISTICIAN"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-extract-status">
                <option value="">Any Status</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING_APPROVAL">Pending</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="afrocat-card p-4 space-y-2">
              <p className="text-xs font-bold text-afrocat-gold uppercase tracking-wider flex items-center gap-2"><LayoutList size={12} /> Choose Fields</p>
              <div className="flex gap-2">
                <button onClick={() => setSelectedFields(new Set(ALL_FIELDS.map(f => f.key)))}
                  className="text-[10px] font-bold text-afrocat-teal cursor-pointer hover:underline" data-testid="button-select-all-fields">Select All</button>
                <span className="text-afrocat-muted text-[10px]">·</span>
                <button onClick={() => setSelectedFields(new Set())}
                  className="text-[10px] font-bold text-afrocat-muted cursor-pointer hover:underline" data-testid="button-clear-fields">Clear All</button>
                <span className="text-afrocat-muted text-[10px]">·</span>
                <button onClick={() => setSelectedFields(new Set(DEFAULT_FIELDS))}
                  className="text-[10px] font-bold text-afrocat-muted cursor-pointer hover:underline" data-testid="button-default-fields">Default</button>
              </div>
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {GROUPS.map(group => {
                  const groupFields = ALL_FIELDS.filter(f => f.group === group);
                  const allGroupSelected = groupFields.every(f => selectedFields.has(f.key));
                  const isOpen = openGroups.has(group);
                  return (
                    <div key={group} className="border border-afrocat-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-afrocat-white-5 cursor-pointer" onClick={() => toggleGroupOpen(group)}>
                        <button onClick={e => { e.stopPropagation(); toggleGroup(group); }}
                          className="cursor-pointer text-afrocat-teal" data-testid={`button-group-${group}`}>
                          {allGroupSelected ? <CheckSquare size={14} /> : <Square size={14} className="text-afrocat-muted" />}
                        </button>
                        <span className="text-xs font-bold text-afrocat-text flex-1">{group}</span>
                        {isOpen ? <ChevronUp size={12} className="text-afrocat-muted" /> : <ChevronDown size={12} className="text-afrocat-muted" />}
                      </div>
                      {isOpen && (
                        <div className="divide-y divide-afrocat-border">
                          {groupFields.map(f => (
                            <label key={f.key} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-afrocat-white-5">
                              <input type="checkbox" checked={selectedFields.has(f.key)} onChange={() => toggleField(f.key)}
                                className="accent-afrocat-teal" data-testid={`checkbox-field-${f.key}`} />
                              <span className="text-xs text-afrocat-text">{f.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <button onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-afrocat-teal hover:underline" data-testid="button-toggle-all-members">
                  {allSelected ? <CheckSquare size={14} /> : someSelected ? <CheckSquare size={14} className="opacity-50" /> : <Square size={14} />}
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
                <span className="text-xs text-afrocat-muted">
                  {isLoading ? "Loading..." : `${memberList.length} member${memberList.length !== 1 ? "s" : ""} found`}
                  {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-afrocat-card border border-afrocat-border rounded-lg overflow-hidden">
                <button onClick={() => setViewLayout("table")}
                  className={`px-2.5 py-1.5 cursor-pointer transition-colors ${viewLayout === "table" ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:bg-afrocat-white-5"}`}
                  data-testid="button-view-table"><Table2 size={14} /></button>
                <button onClick={() => setViewLayout("cards")}
                  className={`px-2.5 py-1.5 cursor-pointer transition-colors ${viewLayout === "cards" ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:bg-afrocat-white-5"}`}
                  data-testid="button-view-cards"><LayoutList size={14} /></button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afrocat-teal" /></div>
            ) : memberList.length === 0 ? (
              <div className="afrocat-card p-12 text-center">
                <Users className="h-16 w-16 mx-auto mb-4 text-afrocat-muted opacity-30" />
                <h3 className="text-lg font-display font-bold text-afrocat-text mb-1">No members found</h3>
                <p className="text-sm text-afrocat-muted">Try adjusting your search or filters.</p>
              </div>
            ) : viewLayout === "table" ? (
              <div className="afrocat-card overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-afrocat-card border-b border-afrocat-border z-10">
                      <tr>
                        <th className="px-3 py-2 w-8">
                          <button onClick={toggleAll} className="cursor-pointer text-afrocat-teal" data-testid="button-table-toggle-all">
                            {allSelected ? <CheckSquare size={14} /> : <Square size={14} className="text-afrocat-muted" />}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-afrocat-gold uppercase tracking-wider w-6">#</th>
                        {orderedFields.map(f => (
                          <th key={f.key} className="px-3 py-2 text-left text-[10px] font-bold text-afrocat-gold uppercase tracking-wider whitespace-nowrap">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-afrocat-border">
                      {memberList.map((m: any, idx: number) => (
                        <tr key={m.id}
                          className={`transition-colors cursor-pointer ${selectedIds.has(m.id) ? "bg-afrocat-teal/10" : "hover:bg-afrocat-white-5"}`}
                          onClick={() => toggleMember(m.id)}
                          data-testid={`row-member-${m.id}`}>
                          <td className="px-3 py-2">
                            <div className="text-afrocat-teal">
                              {selectedIds.has(m.id) ? <CheckSquare size={14} /> : <Square size={14} className="text-afrocat-muted" />}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-afrocat-muted">{idx + 1}</td>
                          {orderedFields.map(f => (
                            <td key={f.key} className={`px-3 py-2 whitespace-nowrap ${f.key === "fullName" ? "font-bold text-afrocat-text" : "text-afrocat-muted"}`}>
                              {formatVal(f.key, m[f.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 max-h-[600px] overflow-y-auto pr-1">
                {memberList.map((m: any, idx: number) => (
                  <div key={m.id} onClick={() => toggleMember(m.id)} data-testid={`card-member-${m.id}`}
                    className={`afrocat-card p-4 cursor-pointer transition-all ${selectedIds.has(m.id) ? "border-afrocat-teal ring-1 ring-afrocat-teal" : "hover:border-afrocat-muted"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`p-0.5 rounded ${selectedIds.has(m.id) ? "text-afrocat-teal" : "text-afrocat-muted"}`}>
                        {selectedIds.has(m.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-afrocat-gold-soft flex items-center justify-center text-sm font-bold text-afrocat-gold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-afrocat-text">{m.fullName || "—"}</p>
                        <p className="text-[10px] text-afrocat-muted">{m.role} {m.teamName ? `· ${m.teamName}` : ""}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {orderedFields.filter(f => f.key !== "fullName" && f.key !== "teamName" && f.key !== "role").map(f => (
                        <div key={f.key}>
                          <p className="text-[9px] text-afrocat-muted uppercase tracking-wider">{f.label}</p>
                          <p className="text-[11px] text-afrocat-text font-medium truncate">{formatVal(f.key, m[f.key])}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showPreview && (
          <div className="afrocat-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-afrocat-gold flex items-center gap-2"><Eye size={14} /> Print Preview</h2>
              <button onClick={() => setShowPreview(false)} className="p-1 rounded hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer">
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-afrocat-muted">{printTarget.length} member{printTarget.length !== 1 ? "s" : ""} · {orderedFields.length} field{orderedFields.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>

      <div id="member-print-area" className="hidden print:block" ref={printRef}>
        <div style={{ fontFamily: "Arial, sans-serif", padding: "20px" }}>
          <div style={{ marginBottom: "16px", borderBottom: "2px solid #c8a84b", paddingBottom: "8px" }}>
            <h1 style={{ margin: 0, fontSize: "18px", color: "#1a1a2e" }}>Afrocat Volleyball Club</h1>
            <h2 style={{ margin: "4px 0 0", fontSize: "14px", color: "#555" }}>Member Data Extract</h2>
            <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#888" }}>
              Generated: {new Date().toLocaleDateString("en-NA", { day: "2-digit", month: "long", year: "numeric" })} ·
              {printTarget.length} member{printTarget.length !== 1 ? "s" : ""} · Fields: {orderedFields.map(f => f.label).join(", ")}
            </p>
          </div>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ backgroundColor: "#1a1a2e", color: "white" }}>
                <th style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: "10px", textAlign: "left" }}>#</th>
                {orderedFields.map(f => (
                  <th key={f.key} style={{ border: "1px solid #ccc", padding: "5px 8px", fontSize: "10px", textAlign: "left", whiteSpace: "nowrap" }}>{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printTarget.map((m: any, idx: number) => (
                <tr key={m.id} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#f9f9f9" }}>
                  <td style={{ border: "1px solid #ddd", padding: "4px 8px", fontSize: "9px", color: "#666" }}>{idx + 1}</td>
                  {orderedFields.map(f => (
                    <td key={f.key} style={{ border: "1px solid #ddd", padding: "4px 8px", fontSize: "9px", fontWeight: f.key === "fullName" ? "bold" : "normal" }}>
                      {formatVal(f.key, m[f.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: "16px", fontSize: "9px", color: "#888", borderTop: "1px solid #ddd", paddingTop: "8px" }}>
            Afrocat Volleyball Club · Confidential · Printed {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </Layout>
  );
}
