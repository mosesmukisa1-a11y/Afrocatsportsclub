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
  register: (data: Record<string, any>) =>
    apiFetch<any>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  verifyEmail: (token: string) =>
    apiFetch<any>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
  me: () => apiFetch<any>("/auth/me"),
  getPublicTeams: () => fetch("/api/public/teams").then(r => r.json()) as Promise<any[]>,

  getPendingRegistrations: () => apiFetch<any[]>("/admin/registrations/pending"),
  approveRegistration: (userId: string) => apiFetch<any>(`/admin/registrations/${userId}/approve`, { method: "POST" }),
  rejectRegistration: (userId: string, reason?: string) => apiFetch<any>(`/admin/registrations/${userId}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  adminVerifyEmail: (userId: string) => apiFetch<any>(`/admin/registrations/${userId}/verify-email`, { method: "POST" }),

  approveTeam: (playerId: string, teamId: string) => apiFetch<any>(`/players/${playerId}/approve-team`, { method: "POST", body: JSON.stringify({ teamId }) }),
  rejectTeam: (playerId: string) => apiFetch<any>(`/players/${playerId}/reject-team`, { method: "POST" }),
  approvePosition: (playerId: string, position: string) => apiFetch<any>(`/players/${playerId}/approve-position`, { method: "POST", body: JSON.stringify({ position }) }),
  rejectPosition: (playerId: string) => apiFetch<any>(`/players/${playerId}/reject-position`, { method: "POST" }),
  approveJersey: (playerId: string, jerseyNo: number) => apiFetch<any>(`/players/${playerId}/approve-jersey`, { method: "POST", body: JSON.stringify({ jerseyNo }) }),
  rejectJersey: (playerId: string) => apiFetch<any>(`/players/${playerId}/reject-jersey`, { method: "POST" }),

  getSecuritySettings: () => apiFetch<any>("/admin/security-settings"),
  updateSecuritySettings: (data: any) => apiFetch<any>("/admin/security-settings", { method: "PUT", body: JSON.stringify(data) }),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    apiFetch<any>("/auth/change-password", { method: "POST", body: JSON.stringify(data) }),
  resetPassword: (data: { email: string; token: string; newPassword: string }) =>
    apiFetch<any>("/auth/reset-password", { method: "POST", body: JSON.stringify(data) }),

  getAdminUsers: (query?: string) => apiFetch<any[]>(`/admin/users${query ? `?query=${encodeURIComponent(query)}` : ""}`),
  adminResetPassword: (userId: string, data: { method: "TEMP_PASSWORD" | "ONE_TIME_LINK"; tempPassword?: string }) =>
    apiFetch<any>(`/admin/users/${userId}/reset-password`, { method: "POST", body: JSON.stringify(data) }),

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
  getUpcomingMatches: () => apiFetch<any[]>("/matches/upcoming"),
  getPlayedMatches: () => apiFetch<any[]>("/matches/played"),
  getMatch: (id: string) => apiFetch<any>(`/matches/${id}`),
  createMatch: (data: any) => apiFetch<any>("/matches", { method: "POST", body: JSON.stringify(data) }),
  updateMatch: (id: string, data: any) => apiFetch<any>(`/matches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  submitMatchScore: (id: string, data: any) => apiFetch<any>(`/matches/${id}/score`, { method: "POST", body: JSON.stringify(data) }),
  submitMatchSetStats: (id: string, data: any) => apiFetch<any>(`/matches/${id}/set-stats`, { method: "POST", body: JSON.stringify(data) }),

  getStatsByMatch: (matchId: string) => apiFetch<any[]>(`/stats/match/${matchId}`),
  getStatsByPlayer: (playerId: string) => apiFetch<any[]>(`/stats/player/${playerId}`),
  submitStats: (matchId: string, data: any[]) =>
    apiFetch<any[]>(`/stats/match/${matchId}`, { method: "POST", body: JSON.stringify(data) }),

  getAttendanceSessions: (teamId?: string) => apiFetch<any[]>(`/attendance/sessions${teamId ? `?teamId=${teamId}` : ""}`),
  createAttendanceSession: (data: any) => apiFetch<any>("/attendance/sessions", { method: "POST", body: JSON.stringify(data) }),
  getAttendanceRecords: (sessionId: string) => apiFetch<any[]>(`/attendance/sessions/${sessionId}/records`),
  submitAttendanceRecords: (sessionId: string, data: any[]) =>
    apiFetch<any[]>(`/attendance/sessions/${sessionId}/records`, { method: "POST", body: JSON.stringify(data) }),
  saveAndCloseAttendance: (sessionId: string, lines: any[]) =>
    apiFetch<any>(`/attendance/sessions/${sessionId}/save`, { method: "POST", body: JSON.stringify(lines) }),
  patchAttendanceSession: (sessionId: string, data: any) =>
    apiFetch<any>(`/attendance/sessions/${sessionId}`, { method: "PATCH", body: JSON.stringify(data) }),

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
  getBirthdays: () => apiFetch<any[]>("/birthdays"),

  getMyTrainingSchedule: () => apiFetch<any>("/training/my-schedule"),
  autoGenerateTraining: () => apiFetch<any>("/training/auto-generate", { method: "POST" }),
  scheduleCustomTraining: (data: any) => apiFetch<any>("/training/schedule-custom", { method: "POST", body: JSON.stringify(data) }),
  getCoachTrainingSummary: (teamId?: string) => apiFetch<any[]>(`/training/coach-summary${teamId ? "?teamId=" + teamId : ""}`),
  getAttendanceReport: (playerId?: string) => apiFetch<any>(`/training/attendance-report${playerId ? "?playerId=" + playerId : ""}`),
  getNotifications: () => apiFetch<any[]>("/notifications"),
  markNotificationRead: (id: string) => apiFetch<any>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => apiFetch<any>("/notifications/read-all", { method: "POST" }),

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
  getMyContract: () => apiFetch<any>("/contracts/my-contract"),
  playerSignContract: (id: string) => apiFetch<any>(`/contracts/${id}/player-sign`, { method: "POST" }),
  sendUnsignedReminders: () => apiFetch<any>("/contracts/send-unsigned-reminders", { method: "POST" }),

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
  generateTeamList: (data: any) => apiFetch<any>("/team-list/generate", { method: "POST", body: JSON.stringify(data) }),

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

  getPublicShop: () => fetch("/api/public/shop").then(r => r.json()) as Promise<any[]>,
  getPublicMedia: () => fetch("/api/public/media").then(r => r.json()) as Promise<any[]>,

  getShopItems: () => apiFetch<any[]>("/shop"),
  createShopItem: (data: any) => apiFetch<any>("/shop", { method: "POST", body: JSON.stringify(data) }),
  updateShopItem: (id: string, data: any) => apiFetch<any>(`/shop/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteShopItem: (id: string) => apiFetch<void>(`/shop/${id}`, { method: "DELETE" }),

  getMedia: (status?: string) => apiFetch<any[]>(`/media${status ? `?status=${status}` : ""}`),
  getPendingMedia: () => apiFetch<any[]>("/media/pending"),
  createMedia: (data: any) => apiFetch<any>("/media", { method: "POST", body: JSON.stringify(data) }),
  approveMedia: (id: string) => apiFetch<any>(`/media/${id}/approve`, { method: "POST" }),
  rejectMedia: (id: string) => apiFetch<any>(`/media/${id}/reject`, { method: "POST" }),

  getMediaTags: (mediaId: string) => apiFetch<any[]>(`/media/${mediaId}/tags`),
  addMediaTags: (mediaId: string, data: { taggedPlayerIds?: string[]; taggedUserIds?: string[] }) =>
    apiFetch<any[]>(`/media/${mediaId}/tags`, { method: "POST", body: JSON.stringify(data) }),
  removeMediaTag: (tagId: string) => apiFetch<void>(`/media/tags/${tagId}`, { method: "DELETE" }),
  requestMediaTag: (mediaId: string) => apiFetch<any>(`/media/${mediaId}/tag-request`, { method: "POST" }),
  getMediaTagRequests: () => apiFetch<any[]>("/media/tag-requests"),
  approveMediaTagRequest: (id: string) => apiFetch<any>(`/media/tag-requests/${id}/approve`, { method: "POST" }),
  rejectMediaTagRequest: (id: string) => apiFetch<any>(`/media/tag-requests/${id}/reject`, { method: "POST" }),

  getMyMedia: () => apiFetch<any[]>("/players/me/media"),
  getCoachMedia: () => apiFetch<any[]>("/coaches/me/media"),

  attendanceCheckIn: (sessionId: string) => apiFetch<any>(`/attendance/sessions/${sessionId}/checkin`, { method: "POST" }),
  confirmAttendance: (recordId: string, data: { status?: string; notes?: string }) =>
    apiFetch<any>(`/attendance/records/${recordId}/confirm`, { method: "POST", body: JSON.stringify(data) }),
  getPendingConfirmations: () => apiFetch<any[]>("/attendance/pending-confirmations"),

  adminCreateUser: (data: { fullName: string; email: string; password: string; role: string }) =>
    apiFetch<any>("/admin/users", { method: "POST", body: JSON.stringify(data) }),
  adminUpdateRole: (userId: string, roles: string[]) =>
    apiFetch<any>(`/admin/users/${userId}/role`, { method: "PUT", body: JSON.stringify({ roles }) }),
  adminDeleteUser: (userId: string) =>
    apiFetch<any>(`/admin/users/${userId}`, { method: "DELETE" }),
  forgotPassword: (email: string) =>
    apiFetch<any>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  getContractContributions: (contractId: string) => apiFetch<any[]>(`/contracts/${contractId}/contributions`),
  getPlayerContributions: (playerId: string) => apiFetch<any[]>(`/contributions/player/${playerId}`),
  createContractContribution: (contractId: string, data: any) => apiFetch<any>(`/contracts/${contractId}/contributions`, { method: "POST", body: JSON.stringify(data) }),
  updateContribution: (id: string, data: any) => apiFetch<any>(`/contributions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteContribution: (id: string) => apiFetch<void>(`/contributions/${id}`, { method: "DELETE" }),

  getFundRaisingActivities: () => apiFetch<any[]>("/fundraising/activities"),
  createFundRaisingActivity: (data: any) => apiFetch<any>("/fundraising/activities", { method: "POST", body: JSON.stringify(data) }),
  updateFundRaisingActivity: (id: string, data: any) => apiFetch<any>(`/fundraising/activities/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteFundRaisingActivity: (id: string) => apiFetch<void>(`/fundraising/activities/${id}`, { method: "DELETE" }),
  getFundRaisingContributions: (activityId?: string, playerId?: string) => {
    const params = new URLSearchParams();
    if (activityId) params.set("activityId", activityId);
    if (playerId) params.set("playerId", playerId);
    return apiFetch<any[]>(`/fundraising/contributions?${params.toString()}`);
  },
  createFundRaisingContribution: (data: any) => apiFetch<any>("/fundraising/contributions", { method: "POST", body: JSON.stringify(data) }),
  updateFundRaisingContribution: (id: string, data: any) => apiFetch<any>(`/fundraising/contributions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteFundRaisingContribution: (id: string) => apiFetch<void>(`/fundraising/contributions/${id}`, { method: "DELETE" }),

  getNextMembershipNo: () => apiFetch<{ membershipNo: string }>("/membership/next"),
  assignMembershipNo: (playerId: string) => apiFetch<any>(`/membership/assign/${playerId}`, { method: "POST" }),
  getPlayerValue: (playerId: string) => apiFetch<any>(`/player-value/${playerId}`),

  getClubContractStatus: () => apiFetch<any>("/contract/status"),
  acceptClubContract: (data: { accepterFullName: string; acceptedBy: string; guardianIdNumber?: string; guardianPhoneNumber?: string }) =>
    apiFetch<any>("/contract/accept", { method: "POST", body: JSON.stringify(data) }),
  getClubContractAdminSummary: () => apiFetch<any>("/contract/admin/summary"),

  getTouchStatsInit: (matchId: string, teamId: string) => apiFetch<any>(`/matches/${matchId}/stats-touch/init?teamId=${teamId}`),
  getMatchEvents: (matchId: string) => apiFetch<any[]>(`/matches/${matchId}/events`),
  createMatchEvent: (matchId: string, data: { playerId: string; action: string; outcome: string; teamId: string }) =>
    apiFetch<any>(`/matches/${matchId}/events`, { method: "POST", body: JSON.stringify(data) }),
  deleteMatchEvent: (matchId: string, eventId: string) =>
    apiFetch<any>(`/matches/${matchId}/events/${eventId}`, { method: "DELETE" }),

  getTeamGenderRules: () => apiFetch<Record<string, string>>("/team-gender-rules"),
  getPendingUpdateRequests: () => apiFetch<any[]>("/player-update-requests/pending"),
  getMyUpdateRequests: () => apiFetch<any[]>("/player-update-requests/mine"),
  approveUpdateRequest: (id: string, reviewNote?: string) =>
    apiFetch<any>(`/player-update-requests/${id}/approve`, { method: "POST", body: JSON.stringify({ reviewNote }) }),
  rejectUpdateRequest: (id: string, reviewNote?: string) =>
    apiFetch<any>(`/player-update-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ reviewNote }) }),
  getWeightStatus: () => apiFetch<any>("/players/me/weight-status"),
};
