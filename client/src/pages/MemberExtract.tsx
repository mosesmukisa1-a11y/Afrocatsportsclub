import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { AFROCAT_LOGO_BASE64 } from "@/lib/logo-base64";
import {
  Search, Printer, CheckSquare, Square, ChevronDown, ChevronUp,
  Filter, Users, FileText, LayoutList, Table2, Eye
} from "lucide-react";

const ALL_FIELDS: { key: string; label: string; group: string }[] = [
  { key: "fullName",      label: "Full Name",            group: "Basic" },
  { key: "email",         label: "Email Address",         group: "Basic" },
  { key: "phone",         label: "Phone Number",          group: "Basic" },
  { key: "role",          label: "Club Role",             group: "Basic" },
  { key: "teamName",      label: "Team",                  group: "Basic" },
  { key: "accountStatus", label: "Account Status",        group: "Basic" },
  { key: "gender",        label: "Gender",                group: "Basic" },

  { key: "dob",           label: "Date of Birth",         group: "Personal" },
  { key: "nationality",   label: "Nationality",           group: "Personal" },
  { key: "idNumber",      label: "ID Number",             group: "Personal" },
  { key: "homeAddress",   label: "Home Address",          group: "Personal" },
  { key: "town",          label: "Town",                  group: "Personal" },
  { key: "region",        label: "Region",                group: "Personal" },

  { key: "position",         label: "Position",           group: "Player" },
  { key: "jerseyNo",         label: "Jersey Number",      group: "Player" },
  { key: "playerStatus",     label: "Player Status",      group: "Player" },
  { key: "eligibilityStatus",label: "Eligibility",        group: "Player" },

  { key: "heightCm",     label: "Height (cm)",            group: "Physical" },
  { key: "weightKg",     label: "Weight (kg)",            group: "Physical" },
  { key: "bloodGroup",   label: "Blood Group",            group: "Physical" },
  { key: "allergies",    label: "Allergies",              group: "Physical" },
  { key: "medicalNotes", label: "Medical Notes",          group: "Physical" },

  { key: "nextOfKinName",     label: "Next of Kin Name",     group: "Next of Kin" },
  { key: "nextOfKinRelation", label: "Next of Kin Relation", group: "Next of Kin" },
  { key: "nextOfKinPhone",    label: "Next of Kin Phone",    group: "Next of Kin" },
  { key: "nextOfKinAddress",  label: "Next of Kin Address",  group: "Next of Kin" },

  { key: "emergencyContactName",  label: "Emergency Contact Name",  group: "Emergency" },
  { key: "emergencyContactPhone", label: "Emergency Contact Phone", group: "Emergency" },

  { key: "membershipNo",      label: "Membership Number",   group: "Registration" },
  { key: "maritalStatus",     label: "Marital Status",      group: "Registration" },
  { key: "facebookName",      label: "Facebook Name",       group: "Registration" },
  { key: "joinedAt",          label: "Date Joined",         group: "Registration" },
  { key: "employmentClass",   label: "Employment Class",    group: "Registration" },
  { key: "registrationStatus",label: "Registration Status", group: "Registration" },
  { key: "registrationNotes", label: "Registration Notes",  group: "Registration" },
];

const GROUPS = [...new Set(ALL_FIELDS.map(f => f.group))];
const DEFAULT_FIELDS = ["fullName", "email", "phone", "teamName", "role", "gender", "dob", "position"];

function ageFromDob(dob: string) {
  if (!dob) return "";
  try {
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
    return isNaN(age) ? "" : ` (${age} yrs)`;
  } catch { return ""; }
}

function formatVal(key: string, val: any) {
  if (val === null || val === undefined || val === "") return "—";
  if (key === "dob") return val + ageFromDob(val);
  if (key === "heightCm") return `${val} cm`;
  if (key === "weightKg") return `${val} kg`;
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

function buildPrintHTML(
  members: any[],
  fields: { key: string; label: string }[],
  filters: { team?: string; gender?: string; role?: string }
) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-NA", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-NA", { hour: "2-digit", minute: "2-digit" });
  const filterDesc = [
    filters.team && `Team: ${filters.team}`,
    filters.gender && `Gender: ${filters.gender}`,
    filters.role && `Role: ${filters.role}`,
  ].filter(Boolean).join(" · ") || "All Members";

  const rows = members.map((m, i) => {
    const cells = fields.map(f =>
      `<td style="${f.key === "fullName" ? "font-weight:bold;" : ""}">${formatVal(f.key, m[f.key])}</td>`
    ).join("");
    return `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f4fafa"};">${cells}</tr>`;
  }).join("");

  const headers = fields.map(f =>
    `<th>${f.label}</th>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Member Data Extract — Afrocat Volleyball Club</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 30px; max-width: 1200px; margin: 0 auto; }

    /* ── Club Header ── */
    .doc-header { text-align: center; border-bottom: 4px solid #0d6e6e; padding-bottom: 18px; margin-bottom: 24px; }
    .doc-header img { width: 80px; height: 80px; object-fit: contain; margin-bottom: 8px; }
    .doc-header .club-name { color: #0d6e6e; font-size: 22px; font-weight: 900; letter-spacing: 2px; margin-bottom: 2px; }
    .doc-header .motto { font-size: 10px; color: #888; letter-spacing: 1px; margin-bottom: 12px; }
    .doc-header .doc-title { font-size: 17px; font-weight: 700; color: #333; background: #f0faf9; display: inline-block; padding: 4px 20px; border-radius: 4px; border: 1px solid #b2dfdb; }

    /* ── Meta bar ── */
    .meta-bar { display: flex; justify-content: space-between; align-items: flex-start; background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px 16px; margin-bottom: 20px; font-size: 12px; gap: 16px; flex-wrap: wrap; }
    .meta-bar .meta-item strong { color: #0d6e6e; display: inline-block; min-width: 80px; }
    .meta-count { background: #0d6e6e; color: white; border-radius: 12px; padding: 2px 10px; font-weight: 700; font-size: 12px; }

    /* ── Section heading ── */
    .section-heading { color: #0d6e6e; font-size: 13px; font-weight: 700; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #e0e0e0; text-transform: uppercase; letter-spacing: 0.5px; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    thead tr { background: #0d6e6e; }
    th { color: white; text-align: left; padding: 7px 9px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; border: 1px solid #0a5a5a; }
    td { border: 1px solid #ddd; padding: 6px 9px; vertical-align: top; }
    .row-no { color: #999; width: 28px; text-align: center; }

    /* ── Signature block ── */
    .sig-block { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; }
    .sig-box { border-top: 1px solid #333; padding-top: 6px; font-size: 11px; }
    .sig-box .sig-label { color: #555; font-size: 10px; }
    .sig-box .sig-name { font-weight: bold; margin-top: 2px; }

    /* ── Footer ── */
    .doc-footer { margin-top: 30px; padding-top: 12px; border-top: 2px solid #e0e0e0; text-align: center; font-size: 10px; color: #999; }
    .doc-footer strong { color: #0d6e6e; }
    .confidential { display: inline-block; margin-top: 6px; background: #fff3cd; color: #856404; font-size: 9px; font-weight: bold; padding: 2px 10px; border-radius: 10px; letter-spacing: 1px; border: 1px solid #ffc107; }

    /* ── Print rules ── */
    @media print {
      body { padding: 12px; }
      .no-print { display: none !important; }
      table { font-size: 9px; }
      th { font-size: 8px; }
      td { padding: 4px 6px; }
      .sig-block { margin-top: 24px; }
    }
  </style>
</head>
<body>

<!-- ══ CLUB HEADER ══ -->
<div class="doc-header">
  <img src="${AFROCAT_LOGO_BASE64}" alt="Afrocat Volleyball Club Logo" />
  <div class="club-name">AFROCAT VOLLEYBALL CLUB</div>
  <div class="motto">One Team One Dream &mdash; Passion &middot; Discipline &middot; Victory</div>
  <div class="doc-title">MEMBER DATA EXTRACT</div>
</div>

<!-- ══ META / INFO BAR ══ -->
<div class="meta-bar">
  <div class="meta-item"><strong>Date:</strong> ${dateStr} at ${timeStr}</div>
  <div class="meta-item"><strong>Filter:</strong> ${filterDesc}</div>
  <div class="meta-item"><strong>Fields:</strong> ${fields.length} selected</div>
  <div class="meta-item"><strong>Records:</strong> <span class="meta-count">${members.length}</span></div>
</div>

<!-- ══ DATA TABLE ══ -->
<div class="section-heading">Member Records</div>
<table>
  <thead>
    <tr>
      <th class="row-no">#</th>
      ${headers}
    </tr>
  </thead>
  <tbody>
    ${members.length > 0 ? rows : `<tr><td colspan="${fields.length + 1}" style="text-align:center;padding:20px;color:#999;">No members found for selected criteria.</td></tr>`}
  </tbody>
</table>

<!-- ══ SIGNATURE BLOCK ══ -->
<div class="sig-block">
  <div class="sig-box">
    <div style="height:36px;"></div>
    <div class="sig-label">Prepared by</div>
    <div class="sig-name">Club Administrator</div>
  </div>
  <div class="sig-box">
    <div style="height:36px;"></div>
    <div class="sig-label">Verified by</div>
    <div class="sig-name">Club Manager</div>
  </div>
  <div class="sig-box">
    <div style="height:36px;"></div>
    <div class="sig-label">Authorised by</div>
    <div class="sig-name">Chairperson</div>
  </div>
</div>

<!-- ══ FOOTER ══ -->
<div class="doc-footer">
  <strong>AFROCAT VOLLEYBALL CLUB</strong> &mdash; One Team One Dream &mdash; Passion &middot; Discipline &middot; Victory<br/>
  Generated on ${dateStr} at ${timeStr} &mdash; Afrocat Club Management Portal
  <br/><span class="confidential">&#128274; CONFIDENTIAL — FOR INTERNAL USE ONLY</span>
</div>

</body>
</html>`;
}

export default function MemberExtract() {
  const [searchQ, setSearchQ] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterGender, setFilterGender] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_FIELDS));
  const [viewLayout, setViewLayout] = useState<"cards" | "table">("table");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(GROUPS));

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["/api/admin/member-extract", searchQ, filterRole, filterTeam, filterGender, filterStatus],
    queryFn: () => api.getMemberExtract({ q: searchQ, role: filterRole, teamId: filterTeam, gender: filterGender, status: filterStatus }),
    staleTime: 30000,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: api.getTeams,
  });

  const orderedFields = useMemo(() =>
    ALL_FIELDS.filter(f => selectedFields.has(f.key)),
    [selectedFields]
  );

  const memberList = members as any[];
  const allSelected = selectedIds.size === memberList.length && memberList.length > 0;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(
      allSelected ? new Set() : new Set(memberList.map((m: any) => m.id))
    );
  };

  const toggleField = (key: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const groupKeys = ALL_FIELDS.filter(f => f.group === group).map(f => f.key);
    const allOn = groupKeys.every(k => selectedFields.has(k));
    setSelectedFields(prev => {
      const next = new Set(prev);
      groupKeys.forEach(k => allOn ? next.delete(k) : next.add(k));
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
    const printTarget = selectedIds.size > 0
      ? memberList.filter((m: any) => selectedIds.has(m.id))
      : memberList;

    if (printTarget.length === 0) return;

    const selectedTeam = (teams as any[]).find((t: any) => t.id === filterTeam);
    const html = buildPrintHTML(printTarget, orderedFields, {
      team: selectedTeam?.name || filterTeam,
      gender: filterGender,
      role: filterRole,
    });

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 600);
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        {/* ── Page Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-7 w-7 text-afrocat-gold" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-extract-title">Member Data Extract</h1>
              <p className="text-xs text-afrocat-muted">Select members and fields, then generate an official club document</p>
            </div>
          </div>
          <button onClick={handlePrint} disabled={memberList.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-gold text-afrocat-bg font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40"
            data-testid="button-print">
            <Printer size={16} />
            {selectedIds.size > 0 ? `Print ${selectedIds.size} Selected` : `Print All (${memberList.length})`}
          </button>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-5">
          {/* ── Left Panel: Filters + Fields ── */}
          <div className="space-y-4">
            {/* Filters */}
            <div className="afrocat-card p-4 space-y-3">
              <p className="text-xs font-bold text-afrocat-gold uppercase tracking-wider flex items-center gap-2">
                <Filter size={12} /> Filter Members
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-afrocat-muted" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search name, email, ID number..."
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
                  {["PLAYER","COACH","MANAGER","ADMIN","MEDICAL","FINANCE","STATISTICIAN"].map(r =>
                    <option key={r} value={r}>{r}</option>
                  )}
                </select>
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-extract-status">
                <option value="">Any Status</option>
                <option value="APPROVED">Approved</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING_APPROVAL">Pending</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {/* Field Picker */}
            <div className="afrocat-card p-4 space-y-2">
              <p className="text-xs font-bold text-afrocat-gold uppercase tracking-wider flex items-center gap-2">
                <LayoutList size={12} /> Choose Fields to Include
              </p>
              <div className="flex gap-3 text-[10px] font-bold">
                <button onClick={() => setSelectedFields(new Set(ALL_FIELDS.map(f => f.key)))}
                  className="text-afrocat-teal cursor-pointer hover:underline" data-testid="button-select-all-fields">Select All</button>
                <button onClick={() => setSelectedFields(new Set())}
                  className="text-afrocat-muted cursor-pointer hover:underline" data-testid="button-clear-fields">Clear</button>
                <button onClick={() => setSelectedFields(new Set(DEFAULT_FIELDS))}
                  className="text-afrocat-muted cursor-pointer hover:underline" data-testid="button-default-fields">Default</button>
                <span className="ml-auto text-afrocat-muted">{selectedFields.size} fields</span>
              </div>

              <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                {GROUPS.map(group => {
                  const groupFields = ALL_FIELDS.filter(f => f.group === group);
                  const allGroupSelected = groupFields.every(f => selectedFields.has(f.key));
                  const someGroupSelected = groupFields.some(f => selectedFields.has(f.key)) && !allGroupSelected;
                  const isOpen = openGroups.has(group);
                  return (
                    <div key={group} className="border border-afrocat-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-afrocat-white-5 cursor-pointer select-none"
                        onClick={() => toggleGroupOpen(group)}>
                        <button onClick={e => { e.stopPropagation(); toggleGroup(group); }}
                          className="cursor-pointer shrink-0" data-testid={`button-group-${group}`}>
                          {allGroupSelected
                            ? <CheckSquare size={13} className="text-afrocat-teal" />
                            : someGroupSelected
                              ? <CheckSquare size={13} className="text-afrocat-teal opacity-50" />
                              : <Square size={13} className="text-afrocat-muted" />
                          }
                        </button>
                        <span className="text-xs font-bold text-afrocat-text flex-1">{group}</span>
                        <span className="text-[10px] text-afrocat-muted">
                          {groupFields.filter(f => selectedFields.has(f.key)).length}/{groupFields.length}
                        </span>
                        {isOpen ? <ChevronUp size={11} className="text-afrocat-muted" /> : <ChevronDown size={11} className="text-afrocat-muted" />}
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

          {/* ── Right Panel: Member List ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <button onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs font-bold cursor-pointer text-afrocat-teal hover:underline"
                  data-testid="button-toggle-all-members">
                  {allSelected ? <CheckSquare size={14} /> : someSelected ? <CheckSquare size={14} className="opacity-50" /> : <Square size={14} />}
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
                <span className="text-xs text-afrocat-muted">
                  {isLoading ? "Loading..." : `${memberList.length} member${memberList.length !== 1 ? "s" : ""}`}
                  {selectedIds.size > 0 && <span className="text-afrocat-teal font-bold"> · {selectedIds.size} selected for print</span>}
                </span>
              </div>
              <div className="flex items-center gap-1 bg-afrocat-card border border-afrocat-border rounded-lg overflow-hidden">
                <button onClick={() => setViewLayout("table")}
                  className={`px-2.5 py-1.5 cursor-pointer transition-colors ${viewLayout === "table" ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:bg-afrocat-white-5"}`}
                  data-testid="button-view-table" title="Table view"><Table2 size={14} /></button>
                <button onClick={() => setViewLayout("cards")}
                  className={`px-2.5 py-1.5 cursor-pointer transition-colors ${viewLayout === "cards" ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:bg-afrocat-white-5"}`}
                  data-testid="button-view-cards" title="Card view"><LayoutList size={14} /></button>
              </div>
            </div>

            {/* Document preview hint */}
            {memberList.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-afrocat-gold-soft border border-afrocat-gold/30 text-afrocat-gold text-xs font-medium">
                <Eye size={13} />
                Clicking "Print" opens an official club-formatted document ready to save as PDF or print.
                {selectedIds.size === 0 && " Select specific members to include only them."}
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afrocat-teal" />
              </div>
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
                          <button onClick={toggleAll} className="cursor-pointer text-afrocat-teal" data-testid="button-table-select-all">
                            {allSelected ? <CheckSquare size={13} /> : <Square size={13} className="text-afrocat-muted" />}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-[10px] font-bold text-afrocat-gold text-left w-7">#</th>
                        {orderedFields.map(f => (
                          <th key={f.key} className="px-3 py-2 text-left text-[10px] font-bold text-afrocat-gold uppercase tracking-wider whitespace-nowrap">{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-afrocat-border">
                      {memberList.map((m: any, idx: number) => (
                        <tr key={m.id}
                          className={`cursor-pointer transition-colors ${selectedIds.has(m.id) ? "bg-afrocat-teal/10" : "hover:bg-afrocat-white-5"}`}
                          onClick={() => toggleMember(m.id)}
                          data-testid={`row-member-${m.id}`}>
                          <td className="px-3 py-2">
                            {selectedIds.has(m.id)
                              ? <CheckSquare size={13} className="text-afrocat-teal" />
                              : <Square size={13} className="text-afrocat-muted" />}
                          </td>
                          <td className="px-2 py-2 text-afrocat-muted text-[10px]">{idx + 1}</td>
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
                      <div className={selectedIds.has(m.id) ? "text-afrocat-teal" : "text-afrocat-muted"}>
                        {selectedIds.has(m.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-afrocat-gold-soft flex items-center justify-center text-xs font-bold text-afrocat-gold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-afrocat-text truncate">{m.fullName || "—"}</p>
                        <p className="text-[10px] text-afrocat-muted">{m.role}{m.teamName ? ` · ${m.teamName}` : ""}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {orderedFields.filter(f => !["fullName","teamName","role"].includes(f.key)).map(f => (
                        <div key={f.key} className="min-w-0">
                          <p className="text-[9px] text-afrocat-muted uppercase tracking-wider truncate">{f.label}</p>
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
      </div>
    </Layout>
  );
}
