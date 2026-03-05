import { eq, and, gte, sql, desc } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import type {
  User, InsertUser, Team, InsertTeam, Player, InsertPlayer,
  Match, InsertMatch, PlayerMatchStat, InsertPlayerMatchStat,
  SmartFocus, InsertSmartFocus, AttendanceSession, InsertAttendanceSession,
  AttendanceRecord, InsertAttendanceRecord, DisciplineCase, InsertDisciplineCase,
  FinanceTxn, InsertFinanceTxn, Injury, InsertInjury,
  Award, InsertAward, CoachAssignment, InsertCoachAssignment,
  CoachPerformanceSnapshot, InsertCoachPerformanceSnapshot,
  PlayerContract, InsertPlayerContract, TeamOfficial, InsertTeamOfficial,
  MatchDocument, InsertMatchDocument, MatchSquad, InsertMatchSquad,
  MatchSquadEntry, InsertMatchSquadEntry, PlayerReport, InsertPlayerReport,
  PlayerDocument, InsertPlayerDocument,
  ContractIssuedItem, InsertContractIssuedItem,
  ContractTransportBenefit, InsertContractTransportBenefit,
  NvfTransferFeeSchedule, InsertNvfTransferFeeSchedule,
  PlayerTransferCase, InsertPlayerTransferCase,
  SystemSecuritySettings, InsertSystemSecuritySettings,
  PasswordResetAudit, InsertPasswordResetAudit,
  ShopItem, InsertShopItem,
  MediaPost, InsertMediaPost,
  MediaTag, InsertMediaTag,
  MediaTagRequest, InsertMediaTagRequest,
  Notification, InsertNotification,
  ContractContribution, InsertContractContribution,
  FundRaisingActivity, InsertFundRaisingActivity,
  PlayerFundRaisingContribution, InsertPlayerFundRaisingContribution,
  MatchSetStat, InsertMatchSetStat,
  MatchEvent, InsertMatchEvent,
  PlayerUpdateRequest, InsertPlayerUpdateRequest,
  NoticeBoardPost, InsertNoticeBoardPost,
  PushSubscription, InsertPushSubscription
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(tokenHash: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  getUserByPlayerId(playerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, data: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<void>;
  getPlayers(): Promise<Player[]>;
  getPlayersByTeam(teamId: string): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: string, data: Partial<InsertPlayer>): Promise<Player | undefined>;
  deletePlayer(id: string): Promise<void>;
  getMatches(): Promise<Match[]>;
  getMatch(id: string): Promise<Match | undefined>;
  getMatchesByTeam(teamId: string): Promise<Match[]>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: string, data: Partial<InsertMatch>): Promise<Match | undefined>;
  deleteMatch(id: string): Promise<void>;
  getMatchSetStats(matchId: string): Promise<MatchSetStat | undefined>;
  createMatchSetStats(stat: InsertMatchSetStat): Promise<MatchSetStat>;
  getUpcomingMatches(from: Date, to: Date): Promise<Match[]>;
  getStatsByMatch(matchId: string): Promise<PlayerMatchStat[]>;
  getStatsByPlayer(playerId: string): Promise<PlayerMatchStat[]>;
  upsertStat(stat: InsertPlayerMatchStat): Promise<PlayerMatchStat>;
  getSmartFocusByPlayer(playerId: string): Promise<SmartFocus[]>;
  createSmartFocus(sf: InsertSmartFocus): Promise<SmartFocus>;
  getAttendanceSessions(teamId?: string): Promise<AttendanceSession[]>;
  getAttendanceSession(id: string): Promise<AttendanceSession | undefined>;
  createAttendanceSession(session: InsertAttendanceSession): Promise<AttendanceSession>;
  updateAttendanceSession(id: string, data: Partial<InsertAttendanceSession>): Promise<AttendanceSession | undefined>;
  getAttendanceRecords(sessionId: string): Promise<AttendanceRecord[]>;
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  getPlayerAbsentCount(playerId: string, since: string): Promise<number>;
  getAttendanceRecordsByPlayer(playerId: string): Promise<AttendanceRecord[]>;
  getDisciplineCases(playerId?: string): Promise<DisciplineCase[]>;
  createDisciplineCase(dc: InsertDisciplineCase): Promise<DisciplineCase>;
  getFinanceTxns(): Promise<FinanceTxn[]>;
  createFinanceTxn(txn: InsertFinanceTxn): Promise<FinanceTxn>;
  deleteFinanceTxn(id: string): Promise<void>;
  getInjuries(): Promise<Injury[]>;
  getInjury(id: string): Promise<Injury | undefined>;
  getInjuriesByPlayer(playerId: string): Promise<Injury[]>;
  createInjury(injury: InsertInjury): Promise<Injury>;
  updateInjury(id: string, data: Partial<InsertInjury>): Promise<Injury | undefined>;
  getAwards(): Promise<Award[]>;
  getAwardsByPlayer(playerId: string): Promise<Award[]>;
  createAward(award: InsertAward): Promise<Award>;
  getCoachAssignments(): Promise<CoachAssignment[]>;
  getCoachAssignmentsByTeam(teamId: string): Promise<CoachAssignment[]>;
  getActiveHeadCoachForTeam(teamId: string, matchDate: string): Promise<CoachAssignment | undefined>;
  createCoachAssignment(ca: InsertCoachAssignment): Promise<CoachAssignment>;
  updateCoachAssignment(id: string, data: Partial<InsertCoachAssignment>): Promise<CoachAssignment | undefined>;
  getCoachPerformance(coachUserId: string): Promise<CoachPerformanceSnapshot | undefined>;
  upsertCoachPerformance(data: InsertCoachPerformanceSnapshot): Promise<CoachPerformanceSnapshot>;
  getPlayerContracts(playerId: string): Promise<PlayerContract[]>;
  getAllContracts(): Promise<PlayerContract[]>;
  getPlayerContract(id: string): Promise<PlayerContract | undefined>;
  createPlayerContract(contract: InsertPlayerContract): Promise<PlayerContract>;
  updatePlayerContract(id: string, data: Partial<InsertPlayerContract>): Promise<PlayerContract | undefined>;
  getTeamOfficials(teamId: string): Promise<TeamOfficial[]>;
  createTeamOfficial(official: InsertTeamOfficial): Promise<TeamOfficial>;
  deleteTeamOfficial(id: string): Promise<void>;
  getMatchDocuments(matchId?: string, teamId?: string): Promise<MatchDocument[]>;
  createMatchDocument(doc: InsertMatchDocument): Promise<MatchDocument>;
  getMatchDocument(id: string): Promise<MatchDocument | undefined>;
  getMatchSquad(matchId: string, teamId: string): Promise<MatchSquad | undefined>;
  createMatchSquad(squad: InsertMatchSquad): Promise<MatchSquad>;
  deleteMatchSquad(id: string): Promise<void>;
  getMatchSquadEntries(squadId: string): Promise<MatchSquadEntry[]>;
  createMatchSquadEntry(entry: InsertMatchSquadEntry): Promise<MatchSquadEntry>;
  deleteMatchSquadEntries(squadId: string): Promise<void>;
  getPlayerReports(playerId: string): Promise<PlayerReport[]>;
  createPlayerReport(report: InsertPlayerReport): Promise<PlayerReport>;
  getPlayerDocuments(playerId: string): Promise<PlayerDocument[]>;
  createPlayerDocument(doc: InsertPlayerDocument): Promise<PlayerDocument>;
  getContractItems(contractId: string): Promise<ContractIssuedItem[]>;
  getContractItem(id: string): Promise<ContractIssuedItem | undefined>;
  createContractItem(item: InsertContractIssuedItem): Promise<ContractIssuedItem>;
  updateContractItem(id: string, data: Partial<InsertContractIssuedItem>): Promise<ContractIssuedItem | undefined>;
  deleteContractItem(id: string): Promise<void>;
  getContractTransportBenefits(contractId: string): Promise<ContractTransportBenefit[]>;
  getContractTransportBenefit(id: string): Promise<ContractTransportBenefit | undefined>;
  createContractTransportBenefit(benefit: InsertContractTransportBenefit): Promise<ContractTransportBenefit>;
  updateContractTransportBenefit(id: string, data: Partial<InsertContractTransportBenefit>): Promise<ContractTransportBenefit | undefined>;
  deleteContractTransportBenefit(id: string): Promise<void>;
  getNvfFees(year?: number): Promise<NvfTransferFeeSchedule[]>;
  getNvfFee(id: string): Promise<NvfTransferFeeSchedule | undefined>;
  getNvfFeeByYearAndType(year: number, feeType: string): Promise<NvfTransferFeeSchedule | undefined>;
  createNvfFee(fee: InsertNvfTransferFeeSchedule): Promise<NvfTransferFeeSchedule>;
  updateNvfFee(id: string, data: Partial<InsertNvfTransferFeeSchedule>): Promise<NvfTransferFeeSchedule | undefined>;
  deleteNvfFee(id: string): Promise<void>;
  getPlayerTransferCases(playerId?: string): Promise<PlayerTransferCase[]>;
  getPlayerTransferCase(id: string): Promise<PlayerTransferCase | undefined>;
  createPlayerTransferCase(tc: InsertPlayerTransferCase): Promise<PlayerTransferCase>;
  updatePlayerTransferCase(id: string, data: Partial<InsertPlayerTransferCase>): Promise<PlayerTransferCase | undefined>;
  getSecuritySettings(): Promise<SystemSecuritySettings | undefined>;
  upsertSecuritySettings(data: Partial<InsertSystemSecuritySettings>): Promise<SystemSecuritySettings>;
  getPendingRegistrations(): Promise<Array<{ user: User; player: Player | undefined }>>;
  getPlayersByJerseyAndTeam(teamId: string, jerseyNo: number): Promise<Player[]>;
  searchUsers(query: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  getUserByResetToken(tokenHash: string): Promise<User | undefined>;
  createPasswordResetAudit(audit: InsertPasswordResetAudit): Promise<PasswordResetAudit>;
  getPasswordResetAudits(targetUserId?: string): Promise<PasswordResetAudit[]>;
  getShopItems(publicOnly?: boolean): Promise<ShopItem[]>;
  getShopItem(id: string): Promise<ShopItem | undefined>;
  createShopItem(item: InsertShopItem): Promise<ShopItem>;
  updateShopItem(id: string, data: Partial<InsertShopItem>): Promise<ShopItem | undefined>;
  deleteShopItem(id: string): Promise<void>;
  getMediaPosts(filter?: { status?: string; visibility?: string }): Promise<MediaPost[]>;
  getMediaPost(id: string): Promise<MediaPost | undefined>;
  createMediaPost(post: InsertMediaPost): Promise<MediaPost>;
  updateMediaPost(id: string, data: Partial<InsertMediaPost>): Promise<MediaPost | undefined>;
  getMediaTags(mediaId: string): Promise<MediaTag[]>;
  getMediaTagsByPlayer(playerId: string): Promise<MediaTag[]>;
  getMediaTagsByUser(userId: string): Promise<MediaTag[]>;
  createMediaTag(tag: InsertMediaTag): Promise<MediaTag>;
  deleteMediaTag(id: string): Promise<void>;
  getMediaTagRequests(status?: string): Promise<MediaTagRequest[]>;
  createMediaTagRequest(req: InsertMediaTagRequest): Promise<MediaTagRequest>;
  updateMediaTagRequest(id: string, data: Partial<InsertMediaTagRequest>): Promise<MediaTagRequest | undefined>;
  updateAttendanceRecord(id: string, data: Partial<InsertAttendanceRecord>): Promise<AttendanceRecord | undefined>;
  getAttendanceRecordBySessionAndPlayer(sessionId: string, playerId: string): Promise<AttendanceRecord | undefined>;
  getNotifications(userId?: string, playerId?: string): Promise<Notification[]>;
  createNotification(notif: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getContractContributions(contractId: string): Promise<ContractContribution[]>;
  getContractContributionsByPlayer(playerId: string): Promise<ContractContribution[]>;
  createContractContribution(c: InsertContractContribution): Promise<ContractContribution>;
  updateContractContribution(id: string, data: Partial<InsertContractContribution>): Promise<ContractContribution | undefined>;
  deleteContractContribution(id: string): Promise<void>;
  getFundRaisingActivities(): Promise<FundRaisingActivity[]>;
  createFundRaisingActivity(a: InsertFundRaisingActivity): Promise<FundRaisingActivity>;
  updateFundRaisingActivity(id: string, data: Partial<InsertFundRaisingActivity>): Promise<FundRaisingActivity | undefined>;
  deleteFundRaisingActivity(id: string): Promise<void>;
  getPlayerFundRaisingContributions(activityId?: string, playerId?: string): Promise<PlayerFundRaisingContribution[]>;
  createPlayerFundRaisingContribution(c: InsertPlayerFundRaisingContribution): Promise<PlayerFundRaisingContribution>;
  updatePlayerFundRaisingContribution(id: string, data: Partial<InsertPlayerFundRaisingContribution>): Promise<PlayerFundRaisingContribution | undefined>;
  deletePlayerFundRaisingContribution(id: string): Promise<void>;
  getNextMembershipNo(): Promise<string>;
  getMatchEvents(matchId: string): Promise<MatchEvent[]>;
  getMatchEvent(id: string): Promise<MatchEvent | undefined>;
  createMatchEvent(event: InsertMatchEvent): Promise<MatchEvent>;
  deleteMatchEvent(id: string): Promise<void>;
  getPlayerUpdateRequests(playerId: string): Promise<PlayerUpdateRequest[]>;
  getPendingUpdateRequests(): Promise<PlayerUpdateRequest[]>;
  createPlayerUpdateRequest(data: InsertPlayerUpdateRequest): Promise<PlayerUpdateRequest>;
  approvePlayerUpdateRequest(id: string, reviewedBy: string, reviewNote?: string): Promise<PlayerUpdateRequest | undefined>;
  rejectPlayerUpdateRequest(id: string, reviewedBy: string, reviewNote?: string): Promise<PlayerUpdateRequest | undefined>;
  getPlayersWithOverdueWeight(): Promise<Player[]>;
  getNoticeBoardPosts(teamId?: string): Promise<NoticeBoardPost[]>;
  createNoticeBoardPost(post: InsertNoticeBoardPost): Promise<NoticeBoardPost>;
  createPushSubscription(sub: InsertPushSubscription): Promise<PushSubscription>;
  getPushSubscriptionsByUser(userId: string): Promise<PushSubscription[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }
  async getUserByEmail(email: string) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }
  async getUserByVerificationToken(tokenHash: string) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.verificationToken, tokenHash));
    return user;
  }
  async getUsersByRole(role: string) {
    return db.select().from(schema.users).where(eq(schema.users.role, role as any));
  }
  async getUserByPlayerId(playerId: string) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.playerId, playerId));
    return user;
  }
  async createUser(user: InsertUser) {
    const [created] = await db.insert(schema.users).values(user).returning();
    return created;
  }
  async updateUser(id: string, data: Partial<InsertUser>) {
    const [updated] = await db.update(schema.users).set(data).where(eq(schema.users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string) {
    const user = await this.getUser(id);
    if (!user) return;
    if (user.playerId) {
      await this.deletePlayer(user.playerId);
    }
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }

  async getTeams() { return db.select().from(schema.teams).orderBy(schema.teams.name); }
  async getTeam(id: string) {
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, id));
    return team;
  }
  async createTeam(team: InsertTeam) {
    const [created] = await db.insert(schema.teams).values(team).returning();
    return created;
  }
  async updateTeam(id: string, data: Partial<InsertTeam>) {
    const [updated] = await db.update(schema.teams).set(data).where(eq(schema.teams.id, id)).returning();
    return updated;
  }
  async deleteTeam(id: string) {
    await db.delete(schema.teams).where(eq(schema.teams.id, id));
  }

  async getPlayers() { return db.select().from(schema.players).orderBy(schema.players.lastName, schema.players.firstName, schema.players.jerseyNo); }
  async getPlayersByTeam(teamId: string) {
    return db.select().from(schema.players).where(eq(schema.players.teamId, teamId)).orderBy(schema.players.lastName, schema.players.firstName, schema.players.jerseyNo);
  }
  async getPlayer(id: string) {
    const [player] = await db.select().from(schema.players).where(eq(schema.players.id, id));
    return player;
  }
  async createPlayer(player: InsertPlayer) {
    const [created] = await db.insert(schema.players).values(player).returning();
    return created;
  }
  async updatePlayer(id: string, data: Partial<InsertPlayer>) {
    const [updated] = await db.update(schema.players).set(data).where(eq(schema.players.id, id)).returning();
    return updated;
  }
  async deletePlayer(id: string) {
    await db.delete(schema.playerMatchStats).where(eq(schema.playerMatchStats.playerId, id));
    await db.delete(schema.attendanceRecords).where(eq(schema.attendanceRecords.playerId, id));
    await db.delete(schema.injuries).where(eq(schema.injuries.playerId, id));
    await db.delete(schema.awards).where(eq(schema.awards.playerId, id));
    await db.delete(schema.playerContracts).where(eq(schema.playerContracts.playerId, id));
    await db.delete(schema.smartFocus).where(eq(schema.smartFocus.playerId, id));
    await db.delete(schema.players).where(eq(schema.players.id, id));
  }

  async getMatches() { return db.select().from(schema.matches).orderBy(desc(schema.matches.matchDate)); }
  async getMatch(id: string) {
    const [match] = await db.select().from(schema.matches).where(eq(schema.matches.id, id));
    return match;
  }
  async getMatchesByTeam(teamId: string) {
    return db.select().from(schema.matches).where(eq(schema.matches.teamId, teamId)).orderBy(desc(schema.matches.matchDate));
  }
  async createMatch(match: InsertMatch) {
    const [created] = await db.insert(schema.matches).values(match).returning();
    return created;
  }
  async updateMatch(id: string, data: Partial<InsertMatch>) {
    const [updated] = await db.update(schema.matches).set(data).where(eq(schema.matches.id, id)).returning();
    return updated;
  }
  async deleteMatch(id: string) {
    await db.delete(schema.matches).where(eq(schema.matches.id, id));
  }
  async getMatchSetStats(matchId: string) {
    const [stat] = await db.select().from(schema.matchSetStats).where(eq(schema.matchSetStats.matchId, matchId));
    return stat;
  }
  async createMatchSetStats(stat: InsertMatchSetStat) {
    const existing = await db.select().from(schema.matchSetStats).where(eq(schema.matchSetStats.matchId, stat.matchId));
    if (existing.length > 0) {
      const [updated] = await db.update(schema.matchSetStats).set(stat).where(eq(schema.matchSetStats.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(schema.matchSetStats).values(stat).returning();
    return created;
  }
  async getUpcomingMatches(from: Date, to: Date) {
    return db.select().from(schema.matches)
      .where(and(
        eq(schema.matches.status, "UPCOMING"),
        gte(schema.matches.startTime, from),
      ));
  }

  async getStatsByMatch(matchId: string) {
    return db.select().from(schema.playerMatchStats).where(eq(schema.playerMatchStats.matchId, matchId));
  }
  async getStatsByPlayer(playerId: string) {
    return db.select().from(schema.playerMatchStats).where(eq(schema.playerMatchStats.playerId, playerId));
  }
  async upsertStat(stat: InsertPlayerMatchStat) {
    const existing = await db.select().from(schema.playerMatchStats)
      .where(and(eq(schema.playerMatchStats.matchId, stat.matchId), eq(schema.playerMatchStats.playerId, stat.playerId)));
    if (existing.length > 0) {
      const [updated] = await db.update(schema.playerMatchStats).set(stat)
        .where(eq(schema.playerMatchStats.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(schema.playerMatchStats).values(stat).returning();
    return created;
  }

  async getSmartFocusByPlayer(playerId: string) {
    return db.select().from(schema.smartFocus).where(eq(schema.smartFocus.playerId, playerId));
  }
  async createSmartFocus(sf: InsertSmartFocus) {
    const [created] = await db.insert(schema.smartFocus).values(sf).returning();
    return created;
  }

  async getAttendanceSessions(teamId?: string) {
    if (teamId) return db.select().from(schema.attendanceSessions).where(eq(schema.attendanceSessions.teamId, teamId));
    return db.select().from(schema.attendanceSessions);
  }
  async getAttendanceSession(id: string) {
    const [session] = await db.select().from(schema.attendanceSessions).where(eq(schema.attendanceSessions.id, id));
    return session;
  }
  async createAttendanceSession(session: InsertAttendanceSession) {
    const [created] = await db.insert(schema.attendanceSessions).values(session).returning();
    return created;
  }
  async updateAttendanceSession(id: string, data: Partial<InsertAttendanceSession>) {
    const [updated] = await db.update(schema.attendanceSessions).set(data).where(eq(schema.attendanceSessions.id, id)).returning();
    return updated;
  }
  async getAttendanceRecords(sessionId: string) {
    return db.select().from(schema.attendanceRecords).where(eq(schema.attendanceRecords.sessionId, sessionId));
  }
  async createAttendanceRecord(record: InsertAttendanceRecord) {
    const [created] = await db.insert(schema.attendanceRecords).values(record).returning();
    return created;
  }
  async getPlayerAbsentCount(playerId: string, since: string) {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.attendanceRecords)
      .innerJoin(schema.attendanceSessions, eq(schema.attendanceRecords.sessionId, schema.attendanceSessions.id))
      .where(and(
        eq(schema.attendanceRecords.playerId, playerId),
        eq(schema.attendanceRecords.status, "ABSENT"),
        gte(schema.attendanceSessions.sessionDate, since)
      ));
    return result[0]?.count ?? 0;
  }
  async getAttendanceRecordsByPlayer(playerId: string) {
    return db.select().from(schema.attendanceRecords).where(eq(schema.attendanceRecords.playerId, playerId));
  }

  async getDisciplineCases(playerId?: string) {
    if (playerId) return db.select().from(schema.disciplineCases).where(eq(schema.disciplineCases.playerId, playerId));
    return db.select().from(schema.disciplineCases);
  }
  async createDisciplineCase(dc: InsertDisciplineCase) {
    const [created] = await db.insert(schema.disciplineCases).values(dc).returning();
    return created;
  }

  async getFinanceTxns() { return db.select().from(schema.financeTxns).orderBy(desc(schema.financeTxns.txnDate)); }
  async createFinanceTxn(txn: InsertFinanceTxn) {
    const [created] = await db.insert(schema.financeTxns).values(txn).returning();
    return created;
  }
  async deleteFinanceTxn(id: string) {
    await db.delete(schema.financeTxns).where(eq(schema.financeTxns.id, id));
  }

  async getInjuries() { return db.select().from(schema.injuries); }
  async getInjury(id: string) {
    const [injury] = await db.select().from(schema.injuries).where(eq(schema.injuries.id, id));
    return injury;
  }
  async getInjuriesByPlayer(playerId: string) {
    return db.select().from(schema.injuries).where(eq(schema.injuries.playerId, playerId));
  }
  async createInjury(injury: InsertInjury) {
    const [created] = await db.insert(schema.injuries).values(injury).returning();
    return created;
  }
  async updateInjury(id: string, data: Partial<InsertInjury>) {
    const [updated] = await db.update(schema.injuries).set(data).where(eq(schema.injuries.id, id)).returning();
    return updated;
  }

  async getAwards() { return db.select().from(schema.awards); }
  async getAwardsByPlayer(playerId: string) {
    return db.select().from(schema.awards).where(eq(schema.awards.playerId, playerId));
  }
  async createAward(award: InsertAward) {
    const [created] = await db.insert(schema.awards).values(award).returning();
    return created;
  }

  async getCoachAssignments() {
    return db.select().from(schema.coachAssignments).orderBy(desc(schema.coachAssignments.startDate));
  }
  async getCoachAssignmentsByTeam(teamId: string) {
    return db.select().from(schema.coachAssignments).where(eq(schema.coachAssignments.teamId, teamId));
  }
  async getActiveHeadCoachForTeam(teamId: string, matchDate: string) {
    const results = await db.select().from(schema.coachAssignments)
      .where(and(
        eq(schema.coachAssignments.teamId, teamId),
        eq(schema.coachAssignments.assignmentRole, "HEAD_COACH"),
        eq(schema.coachAssignments.active, true),
      ));
    return results.find(a => a.startDate <= matchDate && (!a.endDate || a.endDate >= matchDate));
  }
  async createCoachAssignment(ca: InsertCoachAssignment) {
    const [created] = await db.insert(schema.coachAssignments).values(ca).returning();
    return created;
  }
  async updateCoachAssignment(id: string, data: Partial<InsertCoachAssignment>) {
    const [updated] = await db.update(schema.coachAssignments).set(data).where(eq(schema.coachAssignments.id, id)).returning();
    return updated;
  }

  async getCoachPerformance(coachUserId: string) {
    const [snap] = await db.select().from(schema.coachPerformanceSnapshots)
      .where(eq(schema.coachPerformanceSnapshots.coachUserId, coachUserId));
    return snap;
  }
  async upsertCoachPerformance(data: InsertCoachPerformanceSnapshot) {
    const existing = await db.select().from(schema.coachPerformanceSnapshots)
      .where(eq(schema.coachPerformanceSnapshots.coachUserId, data.coachUserId));
    if (existing.length > 0) {
      const [updated] = await db.update(schema.coachPerformanceSnapshots)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.coachPerformanceSnapshots.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(schema.coachPerformanceSnapshots).values(data).returning();
    return created;
  }

  async getPlayerContracts(playerId: string) {
    return db.select().from(schema.playerContracts)
      .where(eq(schema.playerContracts.playerId, playerId))
      .orderBy(desc(schema.playerContracts.createdAt));
  }
  async getAllContracts() {
    return db.select().from(schema.playerContracts);
  }
  async getPlayerContract(id: string) {
    const [contract] = await db.select().from(schema.playerContracts).where(eq(schema.playerContracts.id, id));
    return contract;
  }
  async createPlayerContract(contract: InsertPlayerContract) {
    const [created] = await db.insert(schema.playerContracts).values(contract).returning();
    return created;
  }
  async updatePlayerContract(id: string, data: Partial<InsertPlayerContract>) {
    const [updated] = await db.update(schema.playerContracts).set(data).where(eq(schema.playerContracts.id, id)).returning();
    return updated;
  }

  async getTeamOfficials(teamId: string) {
    return db.select().from(schema.teamOfficials).where(eq(schema.teamOfficials.teamId, teamId));
  }
  async createTeamOfficial(official: InsertTeamOfficial) {
    const [created] = await db.insert(schema.teamOfficials).values(official).returning();
    return created;
  }
  async deleteTeamOfficial(id: string) {
    await db.delete(schema.teamOfficials).where(eq(schema.teamOfficials.id, id));
  }

  async getMatchDocuments(matchId?: string, teamId?: string) {
    if (matchId) return db.select().from(schema.matchDocuments).where(eq(schema.matchDocuments.matchId, matchId)).orderBy(desc(schema.matchDocuments.createdAt));
    if (teamId) return db.select().from(schema.matchDocuments).where(eq(schema.matchDocuments.teamId, teamId)).orderBy(desc(schema.matchDocuments.createdAt));
    return db.select().from(schema.matchDocuments).orderBy(desc(schema.matchDocuments.createdAt));
  }
  async createMatchDocument(doc: InsertMatchDocument) {
    const [created] = await db.insert(schema.matchDocuments).values(doc).returning();
    return created;
  }
  async getMatchDocument(id: string) {
    const [doc] = await db.select().from(schema.matchDocuments).where(eq(schema.matchDocuments.id, id));
    return doc;
  }

  async getMatchSquad(matchId: string, teamId: string) {
    const [squad] = await db.select().from(schema.matchSquads)
      .where(and(eq(schema.matchSquads.matchId, matchId), eq(schema.matchSquads.teamId, teamId)));
    return squad;
  }
  async createMatchSquad(squad: InsertMatchSquad) {
    const [created] = await db.insert(schema.matchSquads).values(squad).returning();
    return created;
  }
  async deleteMatchSquad(id: string) {
    await db.delete(schema.matchSquadEntries).where(eq(schema.matchSquadEntries.squadId, id));
    await db.delete(schema.matchSquads).where(eq(schema.matchSquads.id, id));
  }
  async getMatchSquadEntries(squadId: string) {
    return db.select().from(schema.matchSquadEntries).where(eq(schema.matchSquadEntries.squadId, squadId));
  }
  async createMatchSquadEntry(entry: InsertMatchSquadEntry) {
    const [created] = await db.insert(schema.matchSquadEntries).values(entry).returning();
    return created;
  }
  async deleteMatchSquadEntries(squadId: string) {
    await db.delete(schema.matchSquadEntries).where(eq(schema.matchSquadEntries.squadId, squadId));
  }

  async getPlayerReports(playerId: string) {
    return db.select().from(schema.playerReports).where(eq(schema.playerReports.playerId, playerId));
  }
  async createPlayerReport(report: InsertPlayerReport) {
    const [created] = await db.insert(schema.playerReports).values(report).returning();
    return created;
  }

  async getPlayerDocuments(playerId: string) {
    return db.select().from(schema.playerDocuments).where(eq(schema.playerDocuments.playerId, playerId)).orderBy(desc(schema.playerDocuments.createdAt));
  }
  async createPlayerDocument(doc: InsertPlayerDocument) {
    const [created] = await db.insert(schema.playerDocuments).values(doc).returning();
    return created;
  }

  async getContractItems(contractId: string) {
    return db.select().from(schema.contractIssuedItems).where(eq(schema.contractIssuedItems.contractId, contractId)).orderBy(desc(schema.contractIssuedItems.dateIssued));
  }
  async getContractItem(id: string) {
    const [item] = await db.select().from(schema.contractIssuedItems).where(eq(schema.contractIssuedItems.id, id));
    return item;
  }
  async createContractItem(item: InsertContractIssuedItem) {
    const [created] = await db.insert(schema.contractIssuedItems).values(item).returning();
    return created;
  }
  async updateContractItem(id: string, data: Partial<InsertContractIssuedItem>) {
    const [updated] = await db.update(schema.contractIssuedItems).set(data).where(eq(schema.contractIssuedItems.id, id)).returning();
    return updated;
  }
  async deleteContractItem(id: string) {
    await db.delete(schema.contractIssuedItems).where(eq(schema.contractIssuedItems.id, id));
  }

  async getContractTransportBenefits(contractId: string) {
    return db.select().from(schema.contractTransportBenefits).where(eq(schema.contractTransportBenefits.contractId, contractId)).orderBy(desc(schema.contractTransportBenefits.dateFrom));
  }
  async getContractTransportBenefit(id: string) {
    const [benefit] = await db.select().from(schema.contractTransportBenefits).where(eq(schema.contractTransportBenefits.id, id));
    return benefit;
  }
  async createContractTransportBenefit(benefit: InsertContractTransportBenefit) {
    const [created] = await db.insert(schema.contractTransportBenefits).values(benefit).returning();
    return created;
  }
  async updateContractTransportBenefit(id: string, data: Partial<InsertContractTransportBenefit>) {
    const [updated] = await db.update(schema.contractTransportBenefits).set(data).where(eq(schema.contractTransportBenefits.id, id)).returning();
    return updated;
  }
  async deleteContractTransportBenefit(id: string) {
    await db.delete(schema.contractTransportBenefits).where(eq(schema.contractTransportBenefits.id, id));
  }

  async getNvfFees(year?: number) {
    if (year) return db.select().from(schema.nvfTransferFeeSchedules).where(eq(schema.nvfTransferFeeSchedules.year, year)).orderBy(desc(schema.nvfTransferFeeSchedules.year));
    return db.select().from(schema.nvfTransferFeeSchedules).orderBy(desc(schema.nvfTransferFeeSchedules.year));
  }
  async getNvfFee(id: string) {
    const [fee] = await db.select().from(schema.nvfTransferFeeSchedules).where(eq(schema.nvfTransferFeeSchedules.id, id));
    return fee;
  }
  async getNvfFeeByYearAndType(year: number, feeType: string) {
    const [fee] = await db.select().from(schema.nvfTransferFeeSchedules)
      .where(and(eq(schema.nvfTransferFeeSchedules.year, year), eq(schema.nvfTransferFeeSchedules.feeType, feeType as any)));
    return fee;
  }
  async createNvfFee(fee: InsertNvfTransferFeeSchedule) {
    const [created] = await db.insert(schema.nvfTransferFeeSchedules).values(fee).returning();
    return created;
  }
  async updateNvfFee(id: string, data: Partial<InsertNvfTransferFeeSchedule>) {
    const [updated] = await db.update(schema.nvfTransferFeeSchedules).set(data).where(eq(schema.nvfTransferFeeSchedules.id, id)).returning();
    return updated;
  }
  async deleteNvfFee(id: string) {
    await db.delete(schema.nvfTransferFeeSchedules).where(eq(schema.nvfTransferFeeSchedules.id, id));
  }

  async getPlayerTransferCases(playerId?: string) {
    if (playerId) return db.select().from(schema.playerTransferCases).where(eq(schema.playerTransferCases.playerId, playerId)).orderBy(desc(schema.playerTransferCases.createdAt));
    return db.select().from(schema.playerTransferCases).orderBy(desc(schema.playerTransferCases.createdAt));
  }
  async getPlayerTransferCase(id: string) {
    const [tc] = await db.select().from(schema.playerTransferCases).where(eq(schema.playerTransferCases.id, id));
    return tc;
  }
  async createPlayerTransferCase(tc: InsertPlayerTransferCase) {
    const [created] = await db.insert(schema.playerTransferCases).values(tc).returning();
    return created;
  }
  async updatePlayerTransferCase(id: string, data: Partial<InsertPlayerTransferCase>) {
    const [updated] = await db.update(schema.playerTransferCases).set(data).where(eq(schema.playerTransferCases.id, id)).returning();
    return updated;
  }

  async getSecuritySettings() {
    const [settings] = await db.select().from(schema.systemSecuritySettings).limit(1);
    return settings;
  }
  async upsertSecuritySettings(data: Partial<InsertSystemSecuritySettings>) {
    const existing = await this.getSecuritySettings();
    if (existing) {
      const [updated] = await db.update(schema.systemSecuritySettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.systemSecuritySettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(schema.systemSecuritySettings)
      .values({ id: "security", ...data } as any).returning();
    return created;
  }
  async getPendingRegistrations() {
    const pendingUsers = await db.select().from(schema.users)
      .where(eq(schema.users.accountStatus, "PENDING_APPROVAL"))
      .orderBy(desc(schema.users.createdAt));
    const results: Array<{ user: User; player: Player | undefined }> = [];
    for (const u of pendingUsers) {
      let player: Player | undefined;
      if (u.playerId) {
        player = await this.getPlayer(u.playerId);
      }
      results.push({ user: u, player });
    }
    return results;
  }
  async getPlayersByJerseyAndTeam(teamId: string, jerseyNo: number) {
    return db.select().from(schema.players)
      .where(and(eq(schema.players.teamId, teamId), eq(schema.players.jerseyNo, jerseyNo)));
  }
  async searchUsers(query: string) {
    const q = `%${query.toLowerCase()}%`;
    return db.select().from(schema.users)
      .where(sql`(lower(${schema.users.fullName}) like ${q} or lower(${schema.users.email}) like ${q})`)
      .orderBy(schema.users.fullName);
  }
  async getAllUsers() {
    return db.select().from(schema.users).orderBy(schema.users.fullName);
  }
  async getUserByResetToken(tokenHash: string) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.passwordResetTokenHash, tokenHash));
    return user;
  }
  async createPasswordResetAudit(audit: InsertPasswordResetAudit) {
    const [created] = await db.insert(schema.passwordResetAudits).values(audit).returning();
    return created;
  }
  async getPasswordResetAudits(targetUserId?: string) {
    if (targetUserId) {
      return db.select().from(schema.passwordResetAudits)
        .where(eq(schema.passwordResetAudits.targetUserId, targetUserId))
        .orderBy(desc(schema.passwordResetAudits.createdAt));
    }
    return db.select().from(schema.passwordResetAudits)
      .orderBy(desc(schema.passwordResetAudits.createdAt));
  }

  async getShopItems(publicOnly?: boolean) {
    if (publicOnly) {
      return db.select().from(schema.shopItems)
        .where(and(eq(schema.shopItems.isPublic, true), eq(schema.shopItems.isActive, true)))
        .orderBy(desc(schema.shopItems.createdAt));
    }
    return db.select().from(schema.shopItems).orderBy(desc(schema.shopItems.createdAt));
  }
  async getShopItem(id: string) {
    const [item] = await db.select().from(schema.shopItems).where(eq(schema.shopItems.id, id));
    return item;
  }
  async createShopItem(item: InsertShopItem) {
    const [created] = await db.insert(schema.shopItems).values(item).returning();
    return created;
  }
  async updateShopItem(id: string, data: Partial<InsertShopItem>) {
    const [updated] = await db.update(schema.shopItems).set(data).where(eq(schema.shopItems.id, id)).returning();
    return updated;
  }
  async deleteShopItem(id: string) {
    await db.delete(schema.shopItems).where(eq(schema.shopItems.id, id));
  }

  async getMediaPosts(filter?: { status?: string; visibility?: string }) {
    let q = db.select().from(schema.mediaPosts);
    const conditions = [];
    if (filter?.status) conditions.push(eq(schema.mediaPosts.status, filter.status as any));
    if (filter?.visibility) conditions.push(eq(schema.mediaPosts.visibility, filter.visibility as any));
    if (conditions.length > 0) {
      return q.where(and(...conditions)).orderBy(desc(schema.mediaPosts.createdAt));
    }
    return q.orderBy(desc(schema.mediaPosts.createdAt));
  }
  async getMediaPost(id: string) {
    const [post] = await db.select().from(schema.mediaPosts).where(eq(schema.mediaPosts.id, id));
    return post;
  }
  async createMediaPost(post: InsertMediaPost) {
    const [created] = await db.insert(schema.mediaPosts).values(post).returning();
    return created;
  }
  async updateMediaPost(id: string, data: Partial<InsertMediaPost>) {
    const [updated] = await db.update(schema.mediaPosts).set(data).where(eq(schema.mediaPosts.id, id)).returning();
    return updated;
  }

  async getMediaTags(mediaId: string) {
    return db.select().from(schema.mediaTags).where(eq(schema.mediaTags.mediaId, mediaId));
  }
  async getMediaTagsByPlayer(playerId: string) {
    return db.select().from(schema.mediaTags).where(eq(schema.mediaTags.taggedPlayerId, playerId));
  }
  async getMediaTagsByUser(userId: string) {
    return db.select().from(schema.mediaTags).where(eq(schema.mediaTags.taggedUserId, userId));
  }
  async createMediaTag(tag: InsertMediaTag) {
    const [created] = await db.insert(schema.mediaTags).values(tag).returning();
    return created;
  }
  async deleteMediaTag(id: string) {
    await db.delete(schema.mediaTags).where(eq(schema.mediaTags.id, id));
  }

  async getMediaTagRequests(status?: string) {
    if (status) {
      return db.select().from(schema.mediaTagRequests)
        .where(eq(schema.mediaTagRequests.status, status as any))
        .orderBy(desc(schema.mediaTagRequests.createdAt));
    }
    return db.select().from(schema.mediaTagRequests).orderBy(desc(schema.mediaTagRequests.createdAt));
  }
  async createMediaTagRequest(req: InsertMediaTagRequest) {
    const [created] = await db.insert(schema.mediaTagRequests).values(req).returning();
    return created;
  }
  async updateMediaTagRequest(id: string, data: Partial<InsertMediaTagRequest>) {
    const [updated] = await db.update(schema.mediaTagRequests).set(data).where(eq(schema.mediaTagRequests.id, id)).returning();
    return updated;
  }

  async updateAttendanceRecord(id: string, data: Partial<InsertAttendanceRecord>) {
    const [updated] = await db.update(schema.attendanceRecords).set(data).where(eq(schema.attendanceRecords.id, id)).returning();
    return updated;
  }
  async getAttendanceRecordBySessionAndPlayer(sessionId: string, playerId: string) {
    const [record] = await db.select().from(schema.attendanceRecords)
      .where(and(eq(schema.attendanceRecords.sessionId, sessionId), eq(schema.attendanceRecords.playerId, playerId)));
    return record;
  }

  async getNotifications(userId?: string, playerId?: string) {
    if (userId) {
      return db.select().from(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .orderBy(desc(schema.notifications.createdAt));
    }
    if (playerId) {
      return db.select().from(schema.notifications)
        .where(eq(schema.notifications.playerId, playerId))
        .orderBy(desc(schema.notifications.createdAt));
    }
    return db.select().from(schema.notifications).orderBy(desc(schema.notifications.createdAt));
  }
  async createNotification(notif: InsertNotification) {
    const [created] = await db.insert(schema.notifications).values(notif).returning();
    return created;
  }
  async markNotificationRead(id: string) {
    await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.id, id));
  }
  async markAllNotificationsRead(userId: string) {
    await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.userId, userId));
  }
  async getContractContributions(contractId: string) {
    return db.select().from(schema.contractContributions).where(eq(schema.contractContributions.contractId, contractId));
  }
  async getContractContributionsByPlayer(playerId: string) {
    return db.select().from(schema.contractContributions).where(eq(schema.contractContributions.playerId, playerId));
  }
  async createContractContribution(c: InsertContractContribution) {
    const [created] = await db.insert(schema.contractContributions).values(c).returning();
    return created;
  }
  async updateContractContribution(id: string, data: Partial<InsertContractContribution>) {
    const [updated] = await db.update(schema.contractContributions).set(data).where(eq(schema.contractContributions.id, id)).returning();
    return updated;
  }
  async deleteContractContribution(id: string) {
    await db.delete(schema.contractContributions).where(eq(schema.contractContributions.id, id));
  }
  async getFundRaisingActivities() {
    return db.select().from(schema.fundRaisingActivities).orderBy(desc(schema.fundRaisingActivities.createdAt));
  }
  async createFundRaisingActivity(a: InsertFundRaisingActivity) {
    const [created] = await db.insert(schema.fundRaisingActivities).values(a).returning();
    return created;
  }
  async updateFundRaisingActivity(id: string, data: Partial<InsertFundRaisingActivity>) {
    const [updated] = await db.update(schema.fundRaisingActivities).set(data).where(eq(schema.fundRaisingActivities.id, id)).returning();
    return updated;
  }
  async deleteFundRaisingActivity(id: string) {
    await db.delete(schema.fundRaisingActivities).where(eq(schema.fundRaisingActivities.id, id));
  }
  async getPlayerFundRaisingContributions(activityId?: string, playerId?: string) {
    if (activityId && playerId) {
      return db.select().from(schema.playerFundRaisingContributions).where(
        and(eq(schema.playerFundRaisingContributions.activityId, activityId), eq(schema.playerFundRaisingContributions.playerId, playerId))
      );
    }
    if (activityId) {
      return db.select().from(schema.playerFundRaisingContributions).where(eq(schema.playerFundRaisingContributions.activityId, activityId));
    }
    if (playerId) {
      return db.select().from(schema.playerFundRaisingContributions).where(eq(schema.playerFundRaisingContributions.playerId, playerId));
    }
    return db.select().from(schema.playerFundRaisingContributions);
  }
  async createPlayerFundRaisingContribution(c: InsertPlayerFundRaisingContribution) {
    const [created] = await db.insert(schema.playerFundRaisingContributions).values(c).returning();
    return created;
  }
  async updatePlayerFundRaisingContribution(id: string, data: Partial<InsertPlayerFundRaisingContribution>) {
    const [updated] = await db.update(schema.playerFundRaisingContributions).set(data).where(eq(schema.playerFundRaisingContributions.id, id)).returning();
    return updated;
  }
  async deletePlayerFundRaisingContribution(id: string) {
    await db.delete(schema.playerFundRaisingContributions).where(eq(schema.playerFundRaisingContributions.id, id));
  }
  async getNextMembershipNo(): Promise<string> {
    const allPlayers = await db.select({ membershipNo: schema.players.membershipNo }).from(schema.players);
    const usedNos = allPlayers.map(p => parseInt(p.membershipNo || "0")).filter(n => !isNaN(n) && n > 0);
    let next = 21;
    while (usedNos.includes(next)) next++;
    return String(next).padStart(3, "0");
  }
  async getMatchEvents(matchId: string) {
    return db.select().from(schema.matchEvents).where(eq(schema.matchEvents.matchId, matchId)).orderBy(desc(schema.matchEvents.createdAt));
  }
  async getMatchEvent(id: string) {
    const [event] = await db.select().from(schema.matchEvents).where(eq(schema.matchEvents.id, id));
    return event;
  }
  async createMatchEvent(event: InsertMatchEvent) {
    const [created] = await db.insert(schema.matchEvents).values(event).returning();
    return created;
  }
  async deleteMatchEvent(id: string) {
    await db.delete(schema.matchEvents).where(eq(schema.matchEvents.id, id));
  }
  async getPlayerUpdateRequests(playerId: string) {
    return db.select().from(schema.playerUpdateRequests)
      .where(eq(schema.playerUpdateRequests.playerId, playerId))
      .orderBy(desc(schema.playerUpdateRequests.submittedAt));
  }
  async getPendingUpdateRequests() {
    return db.select().from(schema.playerUpdateRequests)
      .where(eq(schema.playerUpdateRequests.status, "PENDING"))
      .orderBy(desc(schema.playerUpdateRequests.submittedAt));
  }
  async createPlayerUpdateRequest(data: InsertPlayerUpdateRequest) {
    const [created] = await db.insert(schema.playerUpdateRequests).values(data).returning();
    return created;
  }
  async approvePlayerUpdateRequest(id: string, reviewedBy: string, reviewNote?: string) {
    const [request] = await db.select().from(schema.playerUpdateRequests)
      .where(eq(schema.playerUpdateRequests.id, id));
    if (!request || request.status !== "PENDING") return undefined;

    const ALLOWED_FIELDS = new Set([
      "firstName", "lastName", "gender", "dob", "phone", "email",
      "homeAddress", "town", "region", "nationality", "idNumber",
      "nextOfKinName", "nextOfKinRelation", "nextOfKinPhone", "nextOfKinAddress",
      "emergencyContactName", "emergencyContactPhone",
      "medicalNotes", "allergies", "bloodGroup", "photoUrl",
      "heightCm", "weightKg", "maritalStatus", "facebookName",
    ]);

    const patch = request.patchJson as Record<string, any>;
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (ALLOWED_FIELDS.has(key)) updateData[key] = value;
    }
    if (updateData.weightKg !== undefined) {
      updateData.lastWeightUpdatedAt = new Date();
    }
    if (Object.keys(updateData).length > 0) {
      await db.update(schema.players).set(updateData).where(eq(schema.players.id, request.playerId));
    }

    const [updated] = await db.update(schema.playerUpdateRequests).set({
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedBy,
      reviewNote: reviewNote || null,
    }).where(eq(schema.playerUpdateRequests.id, id)).returning();
    return updated;
  }
  async rejectPlayerUpdateRequest(id: string, reviewedBy: string, reviewNote?: string) {
    const [updated] = await db.update(schema.playerUpdateRequests).set({
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedBy,
      reviewNote: reviewNote || null,
    }).where(eq(schema.playerUpdateRequests.id, id)).returning();
    return updated;
  }
  async getPlayersWithOverdueWeight() {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const allPlayers = await db.select().from(schema.players);
    return allPlayers.filter(p =>
      !p.lastWeightUpdatedAt || new Date(p.lastWeightUpdatedAt) < ninetyDaysAgo
    );
  }
  async getNoticeBoardPosts(teamId?: string) {
    const all = await db.select().from(schema.noticeBoardPosts).orderBy(desc(schema.noticeBoardPosts.createdAt));
    if (!teamId) return all.filter(p => p.audience === "ALL");
    return all.filter(p => p.audience === "ALL" || (p.audience === "TEAM" && p.teamId === teamId));
  }
  async createNoticeBoardPost(post: InsertNoticeBoardPost) {
    const [created] = await db.insert(schema.noticeBoardPosts).values(post).returning();
    return created;
  }
  async createPushSubscription(sub: InsertPushSubscription) {
    const existing = await db.select().from(schema.pushSubscriptions)
      .where(and(eq(schema.pushSubscriptions.userId, sub.userId), eq(schema.pushSubscriptions.endpoint, sub.endpoint)));
    if (existing.length > 0) {
      const [updated] = await db.update(schema.pushSubscriptions)
        .set({ p256dh: sub.p256dh, auth: sub.auth })
        .where(eq(schema.pushSubscriptions.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(schema.pushSubscriptions).values(sub).returning();
    return created;
  }
  async getPushSubscriptionsByUser(userId: string) {
    return db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId));
  }
}

export const storage = new DatabaseStorage();
