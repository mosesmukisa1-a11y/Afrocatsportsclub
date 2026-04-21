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
  getPendingPasswordResets: () => apiFetch<any[]>("/admin/password-reset-requests"),
  approvePasswordReset: (userId: string) =>
    apiFetch<any>(`/admin/users/${userId}/approve-reset`, { method: "POST" }),
  rejectPasswordReset: (userId: string) =>
    apiFetch<any>(`/admin/users/${userId}/reject-reset`, { method: "POST" }),

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
  submitFinalScore: (id: string, data: { homeScore: number; awayScore: number }) =>
    apiFetch<any>(`/matches/${id}/final-score`, { method: "PATCH", body: JSON.stringify(data) }),
  submitMatchSetStats: (id: string, data: any) => apiFetch<any>(`/matches/${id}/set-stats`, { method: "POST", body: JSON.stringify(data) }),

  getStatsByMatch: (matchId: string) => apiFetch<any[]>(`/stats/match/${matchId}`),
  getStatsByPlayer: (playerId: string) => apiFetch<any[]>(`/stats/player/${playerId}`),

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
  getMatchMvps: () => apiFetch<any[]>("/awards/match-mvps"),
  getPlayerMvps: (playerId: string) => apiFetch<any[]>(`/awards/player/${playerId}/mvps`),
  getAwardsLeaderboard: () => apiFetch<any>("/awards/leaderboard"),

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
  getCoachDetailedPerformance: (coachUserId: string) => apiFetch<any>(`/coaches/${coachUserId}/performance/detailed`),
  getCoachUsers: () => apiFetch<any[]>("/users/coaches"),
  getAllMembers: () => apiFetch<any[]>("/users/all-members"),

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

  autoSelectLiberos: (matchId: string, teamId: string) =>
    apiFetch<any>(`/matches/${matchId}/squad/auto-select-liberos`, { method: "POST", body: JSON.stringify({ teamId }) }),
  checkLiberos: (matchId: string, teamId: string) =>
    apiFetch<any>(`/matches/${matchId}/squad/libero-check?teamId=${teamId}`),

  getSquadEligibility: (teamId: string) => apiFetch<any[]>(`/squad/eligibility/${teamId}`),
  getMatchSquad: (matchId: string, teamId: string) => apiFetch<any>(`/squad/${matchId}/${teamId}`),
  saveMatchSquad: (data: { matchId: string; teamId: string; playerIds: string[]; playerDetails?: Record<string, { isLibero?: boolean; isCaptain?: boolean; matchPosition?: string }> }) =>
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
  uploadMedia: async (formData: FormData) => {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const fileEntry = formData.get("file");
    if (fileEntry) {
      formData.delete("file");
      formData.append("files", fileEntry);
    }
    const res = await fetch("/api/media/upload", { method: "POST", headers, body: formData });
    if (!res.ok) { const b = await res.json().catch(() => ({ message: "Upload failed" })); throw new Error(b.message || `HTTP ${res.status}`); }
    return res.json();
  },
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

  attendanceCheckIn: (sessionId: string, data?: { status?: string; reason?: string }) =>
    apiFetch<any>(`/attendance/sessions/${sessionId}/checkin`, { method: "POST", body: JSON.stringify(data || {}) }),
  confirmAttendance: (recordId: string, data: { status?: string; notes?: string }) =>
    apiFetch<any>(`/attendance/records/${recordId}/confirm`, { method: "POST", body: JSON.stringify(data) }),
  getPendingConfirmations: () => apiFetch<any[]>("/attendance/pending-confirmations"),
  getMyAttendanceSessions: () => apiFetch<any[]>("/attendance/my-sessions"),

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
  bulkAutoSignContract: () => apiFetch<any>("/contract/bulk-auto-sign", { method: "POST" }),

  getTouchStatsInit: (matchId: string, teamId: string) => apiFetch<any>(`/matches/${matchId}/stats-touch/init?teamId=${teamId}`),
  syncTouchStats: (matchId: string) => apiFetch<any>(`/matches/${matchId}/stats-touch/sync`, { method: "POST" }),
  getMatchById: (matchId: string) => apiFetch<any>(`/matches/${matchId}`),
  getMatchEvents: (matchId: string) => apiFetch<any[]>(`/matches/${matchId}/events`),
  createMatchEvent: (matchId: string, data: any) =>
    apiFetch<any>(`/matches/${matchId}/events`, { method: "POST", body: JSON.stringify(data) }),
  deleteMatchEvent: (matchId: string, eventId: string) =>
    apiFetch<any>(`/matches/${matchId}/events/${eventId}`, { method: "DELETE" }),
  scoreboardPoint: (matchId: string, side: "AFROCAT" | "OPP") =>
    apiFetch<any>(`/matches/${matchId}/scoreboard/point`, { method: "POST", body: JSON.stringify({ side }) }),
  scoreboardUndoLast: (matchId: string) =>
    apiFetch<any>(`/matches/${matchId}/scoreboard/undo-last`, { method: "POST" }),
  scoreboardUndoPoint: (matchId: string) =>
    apiFetch<any>(`/matches/${matchId}/scoreboard/undo-point`, { method: "POST" }),
  scoreboardEndSet: (matchId: string, winner: "home" | "away") =>
    apiFetch<any>(`/matches/${matchId}/scoreboard/end-set`, { method: "POST", body: JSON.stringify({ winner }) }),
  scoreboardDecrement: (matchId: string, side: "home" | "away") =>
    apiFetch<any>(`/matches/${matchId}/scoreboard/decrement`, { method: "POST", body: JSON.stringify({ side }) }),
  setMatchFormat: (matchId: string, bestOf: 3 | 5) =>
    apiFetch<any>(`/matches/${matchId}/format`, { method: "PATCH", body: JSON.stringify({ bestOf }) }),
  finalizeMatch: (matchId: string) =>
    apiFetch<any>(`/matches/${matchId}/finalize`, { method: "POST" }),
  getMatchReport: (matchId: string) => apiFetch<any>(`/matches/${matchId}/report`),

  getDevStatsInit: (matchId: string, teamId: string) =>
    apiFetch<any>(`/matches/${matchId}/devstats/init?teamId=${teamId}`),
  createDevStatsEvent: (matchId: string, data: any) =>
    apiFetch<any>(`/matches/${matchId}/devstats/events`, { method: "POST", body: JSON.stringify(data) }),
  deleteDevStatsEvent: (matchId: string, eventId: string) =>
    apiFetch<any>(`/matches/${matchId}/devstats/events/${eventId}`, { method: "DELETE" }),
  generateDevStatsReport: (matchId: string, teamId: string) =>
    apiFetch<any>(`/matches/${matchId}/devstats/report/generate`, { method: "POST", body: JSON.stringify({ teamId }) }),
  getCoachDevStatsDashboard: (teamId: string, matchId: string) =>
    apiFetch<any>(`/coach/devstats/dashboard?teamId=${teamId}&matchId=${matchId}`),

  getTeamGenderRules: () => apiFetch<Record<string, string>>("/team-gender-rules"),
  getPendingUpdateRequests: () => apiFetch<any[]>("/player-update-requests/pending"),
  getMyUpdateRequests: () => apiFetch<any[]>("/player-update-requests/mine"),
  approveUpdateRequest: (id: string, reviewNote?: string) =>
    apiFetch<any>(`/player-update-requests/${id}/approve`, { method: "POST", body: JSON.stringify({ reviewNote }) }),
  rejectUpdateRequest: (id: string, reviewNote?: string) =>
    apiFetch<any>(`/player-update-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ reviewNote }) }),
  getWeightStatus: () => apiFetch<any>("/players/me/weight-status"),
  getPlayerSpotlight: () => apiFetch<any>("/player-spotlight"),

  compareStats: (player1: string, player2: string) =>
    apiFetch<any>(`/stats/compare?player1=${player1}&player2=${player2}`),
  getSimulationTeamStats: (teamId: string) =>
    apiFetch<any>(`/simulation/team-stats/${teamId}`),

  generateSeasonSummary: (teamId?: string) =>
    apiFetch<any>("/reports/season-summary", { method: "POST", body: JSON.stringify({ teamId }) }),
  generatePlayerReport: (playerId: string) =>
    apiFetch<any>(`/reports/player-report/${playerId}`, { method: "POST", body: JSON.stringify({}) }),
  generateTeamRoster: (teamId: string) =>
    apiFetch<any>(`/reports/team-roster/${teamId}`, { method: "POST", body: JSON.stringify({}) }),
  generateAttendanceSummary: (data: { teamId?: string; startDate?: string; endDate?: string }) =>
    apiFetch<any>("/reports/attendance-summary", { method: "POST", body: JSON.stringify(data) }),
  generateFinancialSummary: (data: { startDate?: string; endDate?: string }) =>
    apiFetch<any>("/reports/financial-summary", { method: "POST", body: JSON.stringify(data) }),

  getChatRooms: () => apiFetch<any[]>("/chat/rooms"),
  getChatMessages: (roomId: string) => apiFetch<any[]>(`/chat/messages/${encodeURIComponent(roomId)}`),
  sendChatMessage: (data: { roomId: string; message: string }) =>
    apiFetch<any>("/chat/messages", { method: "POST", body: JSON.stringify(data) }),

  getStaffEligibleUsers: () => apiFetch<any[]>("/staff-eligible-users"),
  editMatch: (id: string, data: any) =>
    apiFetch<any>(`/matches/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getMatchStaff: (matchId: string) =>
    apiFetch<any>(`/matches/${matchId}/staff`),
  saveMatchStaff: (matchId: string, data: any) =>
    apiFetch<any>(`/matches/${matchId}/staff`, { method: "POST", body: JSON.stringify(data) }),
  checkO2bis: (matchId: string) =>
    apiFetch<any>(`/docs/o2bis/${matchId}/check`),
  getO2bisPdfUrl: (matchId: string, skipMissing: boolean) =>
    `/api/docs/o2bis/${matchId}.pdf?skipMissing=${skipMissing}`,

  getNotices: () => apiFetch<any[]>("/notices"),
  createNotice: (data: { title: string; body: string; audience: string; teamId?: string }) =>
    apiFetch<any>("/notices", { method: "POST", body: JSON.stringify(data) }),

  sendEmail: (data: { to: string; subject: string; text?: string; html?: string }) =>
    apiFetch<any>("/email/send", { method: "POST", body: JSON.stringify(data) }),

  subscribePush: (subscription: any) =>
    apiFetch<any>("/push/subscribe", { method: "POST", body: JSON.stringify(subscription) }),
  getVapidKey: () => apiFetch<{ key: string }>("/push/vapid-key"),

  getChatDmThreads: () => apiFetch<any[]>("/chat/dm-threads"),
  startDm: (targetUserId: string) =>
    apiFetch<any>("/chat/dm", { method: "POST", body: JSON.stringify({ targetUserId }) }),
  getChatUsers: () => apiFetch<any[]>("/chat/users"),

  getCoachBlogPosts: () => apiFetch<any[]>("/coach-blog"),
  getCoachBlogPost: (id: string) => apiFetch<any>(`/coach-blog/${id}`),
  createCoachBlogPost: (data: { title: string; body: string; category: string; tags?: string[]; pinned?: boolean }) =>
    apiFetch<any>("/coach-blog", { method: "POST", body: JSON.stringify(data) }),
  updateCoachBlogPost: (id: string, data: Record<string, any>) =>
    apiFetch<any>(`/coach-blog/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCoachBlogPost: (id: string) =>
    apiFetch<void>(`/coach-blog/${id}`, { method: "DELETE" }),
  addCoachBlogComment: (postId: string, body: string) =>
    apiFetch<any>(`/coach-blog/${postId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  deleteCoachBlogComment: (postId: string, commentId: string) =>
    apiFetch<void>(`/coach-blog/${postId}/comments/${commentId}`, { method: "DELETE" }),

  getTrainingSessions: (teamId?: string) => apiFetch<any[]>(`/training/sessions${teamId ? `?teamId=${teamId}` : ""}`),
  createTrainingSession: (data: any) => apiFetch<any>("/training/sessions", { method: "POST", body: JSON.stringify(data) }),
  updateTrainingSession: (id: string, data: any) => apiFetch<any>(`/training/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTrainingSession: (id: string) => apiFetch<void>(`/training/sessions/${id}`, { method: "DELETE" }),

  submitExcuseRequest: (data: any) => apiFetch<any>("/attendance/excuse-request", { method: "POST", body: JSON.stringify(data) }),
  getExcuseRequests: () => apiFetch<any[]>("/attendance/excuse-requests"),
  getMyExcuseRequests: () => apiFetch<any[]>("/attendance/excuse-requests/mine"),
  approveExcuseRequest: (id: string, reviewNote?: string) => apiFetch<any>(`/attendance/excuse-requests/${id}/approve`, { method: "POST", body: JSON.stringify({ reviewNote }) }),
  rejectExcuseRequest: (id: string, reviewNote?: string) => apiFetch<any>(`/attendance/excuse-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ reviewNote }) }),

  getFeeConfig: () => apiFetch<Record<string, string>>("/finance/fee-config"),
  updateFeeConfig: (data: Record<string, string>) => apiFetch<any>("/finance/fee-config", { method: "PUT", body: JSON.stringify(data) }),
  getFinancePayments: (playerId?: string) => apiFetch<any[]>(`/finance/payments${playerId ? `?playerId=${playerId}` : ""}`),
  createFinancePayment: (data: any) => apiFetch<any>("/finance/payment", { method: "POST", body: JSON.stringify(data) }),
  approveFinancePayment: (id: string) => apiFetch<any>(`/finance/payment/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
  rejectFinancePayment: (id: string) => apiFetch<any>(`/finance/payment/${id}/reject`, { method: "POST", body: JSON.stringify({}) }),
  getFinanceExpenses: (playerId?: string) => apiFetch<any[]>(`/finance/expenses${playerId ? `?playerId=${playerId}` : ""}`),
  createFinanceExpense: (data: any) => apiFetch<any>("/finance/expense", { method: "POST", body: JSON.stringify(data) }),
  approveFinanceExpense: (id: string) => apiFetch<any>(`/finance/expense/${id}/approve`, { method: "POST", body: JSON.stringify({}) }),
  rejectFinanceExpense: (id: string) => apiFetch<any>(`/finance/expense/${id}/reject`, { method: "POST", body: JSON.stringify({}) }),
  getPlayerFinance: (playerId: string) => apiFetch<any>(`/finance/player/${playerId}`),
  getPlayerExitStatement: (playerId: string) => apiFetch<any>(`/finance/player/${playerId}/exit-statement`),
  getFinanceSummary: (from?: string, to?: string) => apiFetch<any>(`/finance/summary${from || to ? `?${from ? `from=${from}` : ""}${to ? `&to=${to}` : ""}` : ""}`),
  getIncomeStatement: (from?: string, to?: string) => apiFetch<any>(`/finance/income-statement${from || to ? `?${from ? `from=${from}` : ""}${to ? `&to=${to}` : ""}` : ""}`),
  getBalanceSheet: () => apiFetch<any>("/finance/balance-sheet"),
  getMyOutstandingFees: () => apiFetch<any>("/finance/my-outstanding"),
  getFinanceValuations: () => apiFetch<any>("/finance/valuations"),

  getCoachMyTeams: () => apiFetch<any[]>("/coach/my-teams"),
  getCoachAttendanceTrends: (teamId: string) => apiFetch<any>(`/coach/attendance-trends?teamId=${teamId}`),
  getCoachPerformanceTrends: (teamId: string) => apiFetch<any[]>(`/coach/performance-trends?teamId=${teamId}`),

  getInterviews: () => apiFetch<any[]>("/interviews"),
  getInterview: (id: string) => apiFetch<any>(`/interviews/${id}`),
  createInterview: (data: any) =>
    apiFetch<any>("/interviews", { method: "POST", body: JSON.stringify(data) }),
  updateInterview: (id: string, data: any) =>
    apiFetch<any>(`/interviews/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteInterview: (id: string) =>
    apiFetch<void>(`/interviews/${id}`, { method: "DELETE" }),
  likeInterview: (id: string) =>
    apiFetch<{ liked: boolean }>(`/interviews/${id}/like`, { method: "POST" }),
  viewInterview: (id: string) =>
    apiFetch<{ ok: boolean }>(`/interviews/${id}/view`, { method: "POST" }),
  getMyInterviewLikes: () =>
    apiFetch<{ likedIds: string[] }>("/interviews-my-likes"),

  searchMembers: (q?: string, role?: string, teamId?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (role) params.set("role", role);
    if (teamId) params.set("teamId", teamId);
    return apiFetch<any[]>(`/members/search?${params.toString()}`);
  },

  getTournamentRoster: (teamId: string) => apiFetch<any[]>(`/tournament-teams/${teamId}/roster`),
  addToTournamentRoster: (teamId: string, data: { playerId: string; position?: string; jerseyNo?: number }) =>
    apiFetch<any>(`/tournament-teams/${teamId}/roster`, { method: "POST", body: JSON.stringify(data) }),
  removeFromTournamentRoster: (teamId: string, playerId: string) =>
    apiFetch<void>(`/tournament-teams/${teamId}/roster/${playerId}`, { method: "DELETE" }),
  updateTournamentRosterEntry: (teamId: string, playerId: string, data: { position?: string; jerseyNo?: number }) =>
    apiFetch<any>(`/tournament-teams/${teamId}/roster/${playerId}`, { method: "PATCH", body: JSON.stringify(data) }),

  getMemberExtract: (filters: { q?: string; role?: string; teamId?: string; gender?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.role) params.set("role", filters.role);
    if (filters.teamId) params.set("teamId", filters.teamId);
    if (filters.gender) params.set("gender", filters.gender);
    if (filters.status) params.set("status", filters.status);
    return apiFetch<any[]>(`/admin/member-extract?${params.toString()}`);
  },

  getOfficials: () => apiFetch<any[]>("/officials"),
  assignOfficial: (data: { officialUserId: string; teamId: string; officialRole: string }) =>
    apiFetch<any>("/officials/assign", { method: "POST", body: JSON.stringify(data) }),
  removeOfficialAssignment: (id: string) =>
    apiFetch<void>(`/officials/assign/${id}`, { method: "DELETE" }),

  getTacticBoards: (teamId?: string) => apiFetch<any[]>(`/tactic-boards${teamId ? `?teamId=${teamId}` : ""}`),
  createTacticBoard: (data: { title: string; boardJson: any; teamId?: string }) =>
    apiFetch<any>("/tactic-boards", { method: "POST", body: JSON.stringify(data) }),
  updateTacticBoard: (id: string, data: { title?: string; boardJson?: any }) =>
    apiFetch<any>(`/tactic-boards/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTacticBoard: (id: string) =>
    apiFetch<void>(`/tactic-boards/${id}`, { method: "DELETE" }),

  uploadMediaMulti: async (formData: FormData) => {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch("/api/media/upload", { method: "POST", headers, body: formData });
    if (!res.ok) { const b = await res.json().catch(() => ({ message: "Upload failed" })); throw new Error(b.message || `HTTP ${res.status}`); }
    return res.json();
  },
};

export async function registerPushNotifications() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const { key } = await api.getVapidKey();
    if (!key) return;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    await api.subscribePush(sub.toJSON());
  } catch (e) {
    console.warn("Push registration failed:", e);
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
