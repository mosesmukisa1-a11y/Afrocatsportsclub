const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (data: { email: string; password: string }) =>
    apiFetch<{ token: string; user: any }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  register: (data: { fullName: string; email: string; password: string }) =>
    apiFetch<{ token: string; user: any }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  me: () => apiFetch<any>("/auth/me"),

  getTeams: () => apiFetch<any[]>("/teams"),
  createTeam: (data: any) => apiFetch<any>("/teams", { method: "POST", body: JSON.stringify(data) }),
  updateTeam: (id: string, data: any) => apiFetch<any>(`/teams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTeam: (id: string) => apiFetch<void>(`/teams/${id}`, { method: "DELETE" }),

  getPlayers: () => apiFetch<any[]>("/players"),
  getPlayersByTeam: (teamId: string) => apiFetch<any[]>(`/players/team/${teamId}`),
  getPlayer: (id: string) => apiFetch<any>(`/players/${id}`),
  createPlayer: (data: any) => apiFetch<any>("/players", { method: "POST", body: JSON.stringify(data) }),
  updatePlayer: (id: string, data: any) => apiFetch<any>(`/players/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlayer: (id: string) => apiFetch<void>(`/players/${id}`, { method: "DELETE" }),

  getMatches: () => apiFetch<any[]>("/matches"),
  getMatch: (id: string) => apiFetch<any>(`/matches/${id}`),
  createMatch: (data: any) => apiFetch<any>("/matches", { method: "POST", body: JSON.stringify(data) }),
  updateMatch: (id: string, data: any) => apiFetch<any>(`/matches/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  getStatsByMatch: (matchId: string) => apiFetch<any[]>(`/stats/match/${matchId}`),
  getStatsByPlayer: (playerId: string) => apiFetch<any[]>(`/stats/player/${playerId}`),
  submitStats: (matchId: string, data: any[]) =>
    apiFetch<any[]>(`/stats/match/${matchId}`, { method: "POST", body: JSON.stringify(data) }),

  getAttendanceSessions: (teamId?: string) => apiFetch<any[]>(`/attendance/sessions${teamId ? `?teamId=${teamId}` : ""}`),
  createAttendanceSession: (data: any) => apiFetch<any>("/attendance/sessions", { method: "POST", body: JSON.stringify(data) }),
  getAttendanceRecords: (sessionId: string) => apiFetch<any[]>(`/attendance/sessions/${sessionId}/records`),
  submitAttendanceRecords: (sessionId: string, data: any[]) =>
    apiFetch<any[]>(`/attendance/sessions/${sessionId}/records`, { method: "POST", body: JSON.stringify(data) }),

  getFinanceTxns: () => apiFetch<any[]>("/finance"),
  createFinanceTxn: (data: any) => apiFetch<any>("/finance", { method: "POST", body: JSON.stringify(data) }),
  deleteFinanceTxn: (id: string) => apiFetch<void>(`/finance/${id}`, { method: "DELETE" }),

  getInjuries: () => apiFetch<any[]>("/injuries"),
  getInjuriesByPlayer: (playerId: string) => apiFetch<any[]>(`/injuries/player/${playerId}`),
  createInjury: (data: any) => apiFetch<any>("/injuries", { method: "POST", body: JSON.stringify(data) }),
  clearInjury: (id: string, clearanceNote: string) =>
    apiFetch<any>(`/injuries/${id}/clear`, { method: "PUT", body: JSON.stringify({ clearanceNote }) }),

  getAwards: () => apiFetch<any[]>("/awards"),
  getAwardsByPlayer: (playerId: string) => apiFetch<any[]>(`/awards/player/${playerId}`),
  createAward: (data: any) => apiFetch<any>("/awards", { method: "POST", body: JSON.stringify(data) }),

  getSmartFocus: (playerId: string) => apiFetch<any[]>(`/smart-focus/player/${playerId}`),

  getCoachDashboard: (teamId: string) => apiFetch<any>("/dashboard/coach/summary?teamId=" + teamId),
  getPlayerDashboard: (playerId: string) => apiFetch<any>("/players/" + playerId + "/dashboard"),

  getCoachAssignments: () => apiFetch<any[]>("/coach-assignments"),
  getCoachAssignmentsByTeam: (teamId: string) => apiFetch<any[]>(`/coach-assignments/team/${teamId}`),
  createCoachAssignment: (data: any) => apiFetch<any>("/coach-assignments", { method: "POST", body: JSON.stringify(data) }),
  updateCoachAssignment: (id: string, data: any) => apiFetch<any>(`/coach-assignments/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  getCoachPerformance: (coachUserId: string) => apiFetch<any>(`/coaches/${coachUserId}/performance`),

  getPlayerContracts: (playerId: string) => apiFetch<any[]>(`/contracts/player/${playerId}`),
  createContract: (data: any) => apiFetch<any>("/contracts", { method: "POST", body: JSON.stringify(data) }),
  updateContract: (id: string, data: any) => apiFetch<any>(`/contracts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  approveContract: (id: string) => apiFetch<any>(`/contracts/${id}/approve`, { method: "POST" }),
  terminateContract: (id: string) => apiFetch<any>(`/contracts/${id}/terminate`, { method: "POST" }),

  getContractItems: (contractId: string) => apiFetch<any[]>(`/contracts/${contractId}/items`),
  createContractItem: (contractId: string, data: any) => apiFetch<any>(`/contracts/${contractId}/items`, { method: "POST", body: JSON.stringify(data) }),
  updateContractItem: (itemId: string, data: any) => apiFetch<any>(`/contracts/items/${itemId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteContractItem: (itemId: string) => apiFetch<void>(`/contracts/items/${itemId}`, { method: "DELETE" }),

  getContractTransport: (contractId: string) => apiFetch<any[]>(`/contracts/${contractId}/transport`),
  createContractTransport: (contractId: string, data: any) => apiFetch<any>(`/contracts/${contractId}/transport`, { method: "POST", body: JSON.stringify(data) }),
  updateContractTransport: (benefitId: string, data: any) => apiFetch<any>(`/contracts/transport/${benefitId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteContractTransport: (benefitId: string) => apiFetch<void>(`/contracts/transport/${benefitId}`, { method: "DELETE" }),

  updateContractFees: (contractId: string, data: any) => apiFetch<any>(`/contracts/${contractId}/fees`, { method: "PUT", body: JSON.stringify(data) }),

  getNvfFees: (year?: number) => apiFetch<any[]>(`/nvf/fees${year ? `?year=${year}` : ""}`),
  createNvfFee: (data: any) => apiFetch<any>("/nvf/fees", { method: "POST", body: JSON.stringify(data) }),
  updateNvfFee: (id: string, data: any) => apiFetch<any>(`/nvf/fees/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNvfFee: (id: string) => apiFetch<void>(`/nvf/fees/${id}`, { method: "DELETE" }),

  calculateTransfer: (data: any) => apiFetch<any>("/transfers/calculate", { method: "POST", body: JSON.stringify(data) }),
  createTransferCase: (data: any) => apiFetch<any>("/transfers", { method: "POST", body: JSON.stringify(data) }),
  getPlayerTransferCases: (playerId: string) => apiFetch<any[]>(`/transfers/player/${playerId}`),
  updateTransferCaseStatus: (id: string, status: string) => apiFetch<any>(`/transfers/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),

  generateContractInvestmentPdf: (contractId: string) => apiFetch<any>(`/contracts/${contractId}/investment-pdf`, { method: "POST" }),
  generateTransferPdf: (transferId: string) => apiFetch<any>(`/transfers/${transferId}/pdf`, { method: "POST" }),

  getTeamOfficials: (teamId: string) => apiFetch<any[]>(`/team-officials/${teamId}`),
  createTeamOfficial: (data: any) => apiFetch<any>("/team-officials", { method: "POST", body: JSON.stringify(data) }),
  deleteTeamOfficial: (id: string) => apiFetch<void>(`/team-officials/${id}`, { method: "DELETE" }),

  getMatchDocuments: (matchId?: string, teamId?: string) => {
    const params = new URLSearchParams();
    if (matchId) params.set("matchId", matchId);
    if (teamId) params.set("teamId", teamId);
    return apiFetch<any[]>(`/match-documents?${params.toString()}`);
  },
  createMatchDocument: (data: any) => apiFetch<any>("/match-documents", { method: "POST", body: JSON.stringify(data) }),
  generateO2bis: (data: any) => apiFetch<any>("/o2bis/generate", { method: "POST", body: JSON.stringify(data) }),

  generateMatchReport: (matchId: string, teamId?: string) =>
    apiFetch<any>("/reports/match/" + matchId + "/pdf", { method: "POST", body: JSON.stringify({ teamId }) }),

  getSquadEligibility: (teamId: string) => apiFetch<any[]>(`/squad/eligibility/${teamId}`),
  getMatchSquad: (matchId: string, teamId: string) => apiFetch<any>(`/squad/${matchId}/${teamId}`),
  saveMatchSquad: (data: { matchId: string; teamId: string; playerIds: string[] }) =>
    apiFetch<any>("/squad", { method: "POST", body: JSON.stringify(data) }),
  deleteMatchSquad: (matchId: string, teamId: string) =>
    apiFetch<void>(`/squad/${matchId}/${teamId}`, { method: "DELETE" }),

  getMyProfile: () => apiFetch<any>("/players/me"),
  updateMyProfile: (data: any) => apiFetch<any>("/players/me", { method: "PUT", body: JSON.stringify(data) }),
  uploadPlayerPhoto: (playerId: string, photoUrl: string) =>
    apiFetch<any>(`/players/${playerId}/photo`, { method: "POST", body: JSON.stringify({ photoUrl }) }),
  generatePlayerProfilePdf: (playerId: string) =>
    apiFetch<any>(`/players/${playerId}/profile/pdf`, { method: "POST" }),
  getPlayerDocuments: (playerId: string) => apiFetch<any[]>(`/player-documents/${playerId}`),
};
