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
  // Auth
  login: (data: { email: string; password: string }) =>
    apiFetch<{ token: string; user: any }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  register: (data: { fullName: string; email: string; password: string }) =>
    apiFetch<{ token: string; user: any }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  me: () => apiFetch<any>("/auth/me"),

  // Teams
  getTeams: () => apiFetch<any[]>("/teams"),
  createTeam: (data: any) => apiFetch<any>("/teams", { method: "POST", body: JSON.stringify(data) }),
  updateTeam: (id: string, data: any) => apiFetch<any>(`/teams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTeam: (id: string) => apiFetch<void>(`/teams/${id}`, { method: "DELETE" }),

  // Players
  getPlayers: () => apiFetch<any[]>("/players"),
  getPlayersByTeam: (teamId: string) => apiFetch<any[]>(`/players/team/${teamId}`),
  getPlayer: (id: string) => apiFetch<any>(`/players/${id}`),
  createPlayer: (data: any) => apiFetch<any>("/players", { method: "POST", body: JSON.stringify(data) }),
  updatePlayer: (id: string, data: any) => apiFetch<any>(`/players/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePlayer: (id: string) => apiFetch<void>(`/players/${id}`, { method: "DELETE" }),

  // Matches
  getMatches: () => apiFetch<any[]>("/matches"),
  getMatch: (id: string) => apiFetch<any>(`/matches/${id}`),
  createMatch: (data: any) => apiFetch<any>("/matches", { method: "POST", body: JSON.stringify(data) }),

  // Stats
  getStatsByMatch: (matchId: string) => apiFetch<any[]>(`/stats/match/${matchId}`),
  getStatsByPlayer: (playerId: string) => apiFetch<any[]>(`/stats/player/${playerId}`),
  submitStats: (matchId: string, data: any[]) =>
    apiFetch<any[]>(`/stats/match/${matchId}`, { method: "POST", body: JSON.stringify(data) }),

  // Attendance
  getAttendanceSessions: (teamId?: string) => apiFetch<any[]>(`/attendance/sessions${teamId ? `?teamId=${teamId}` : ""}`),
  createAttendanceSession: (data: any) => apiFetch<any>("/attendance/sessions", { method: "POST", body: JSON.stringify(data) }),
  getAttendanceRecords: (sessionId: string) => apiFetch<any[]>(`/attendance/sessions/${sessionId}/records`),
  submitAttendanceRecords: (sessionId: string, data: any[]) =>
    apiFetch<any[]>(`/attendance/sessions/${sessionId}/records`, { method: "POST", body: JSON.stringify(data) }),

  // Finance
  getFinanceTxns: () => apiFetch<any[]>("/finance"),
  createFinanceTxn: (data: any) => apiFetch<any>("/finance", { method: "POST", body: JSON.stringify(data) }),
  deleteFinanceTxn: (id: string) => apiFetch<void>(`/finance/${id}`, { method: "DELETE" }),

  // Injuries
  getInjuries: () => apiFetch<any[]>("/injuries"),
  getInjuriesByPlayer: (playerId: string) => apiFetch<any[]>(`/injuries/player/${playerId}`),
  createInjury: (data: any) => apiFetch<any>("/injuries", { method: "POST", body: JSON.stringify(data) }),
  clearInjury: (id: string, clearanceNote: string) =>
    apiFetch<any>(`/injuries/${id}/clear`, { method: "PUT", body: JSON.stringify({ clearanceNote }) }),

  // Awards
  getAwards: () => apiFetch<any[]>("/awards"),
  getAwardsByPlayer: (playerId: string) => apiFetch<any[]>(`/awards/player/${playerId}`),
  createAward: (data: any) => apiFetch<any>("/awards", { method: "POST", body: JSON.stringify(data) }),

  // Smart Focus
  getSmartFocus: (playerId: string) => apiFetch<any[]>(`/smart-focus/player/${playerId}`),
};
