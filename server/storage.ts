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
  MatchSquadEntry, InsertMatchSquadEntry, PlayerReport, InsertPlayerReport
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
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
  getStatsByMatch(matchId: string): Promise<PlayerMatchStat[]>;
  getStatsByPlayer(playerId: string): Promise<PlayerMatchStat[]>;
  upsertStat(stat: InsertPlayerMatchStat): Promise<PlayerMatchStat>;
  getSmartFocusByPlayer(playerId: string): Promise<SmartFocus[]>;
  createSmartFocus(sf: InsertSmartFocus): Promise<SmartFocus>;
  getAttendanceSessions(teamId?: string): Promise<AttendanceSession[]>;
  getAttendanceSession(id: string): Promise<AttendanceSession | undefined>;
  createAttendanceSession(session: InsertAttendanceSession): Promise<AttendanceSession>;
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
  async createUser(user: InsertUser) {
    const [created] = await db.insert(schema.users).values(user).returning();
    return created;
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

  async getPlayers() { return db.select().from(schema.players).orderBy(schema.players.lastName); }
  async getPlayersByTeam(teamId: string) {
    return db.select().from(schema.players).where(eq(schema.players.teamId, teamId));
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
}

export const storage = new DatabaseStorage();
