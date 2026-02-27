import { eq, and, gte, sql, desc } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import type {
  User, InsertUser, Team, InsertTeam, Player, InsertPlayer,
  Match, InsertMatch, PlayerMatchStat, InsertPlayerMatchStat,
  SmartFocus, InsertSmartFocus, AttendanceSession, InsertAttendanceSession,
  AttendanceRecord, InsertAttendanceRecord, DisciplineCase, InsertDisciplineCase,
  FinanceTxn, InsertFinanceTxn, Injury, InsertInjury,
  Award, InsertAward
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  // Teams
  getTeams(): Promise<Team[]>;
  getTeam(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, data: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: string): Promise<void>;
  // Players
  getPlayers(): Promise<Player[]>;
  getPlayersByTeam(teamId: string): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: string, data: Partial<InsertPlayer>): Promise<Player | undefined>;
  deletePlayer(id: string): Promise<void>;
  // Matches
  getMatches(): Promise<Match[]>;
  getMatch(id: string): Promise<Match | undefined>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: string, data: Partial<InsertMatch>): Promise<Match | undefined>;
  deleteMatch(id: string): Promise<void>;
  // Stats
  getStatsByMatch(matchId: string): Promise<PlayerMatchStat[]>;
  getStatsByPlayer(playerId: string): Promise<PlayerMatchStat[]>;
  upsertStat(stat: InsertPlayerMatchStat): Promise<PlayerMatchStat>;
  // SmartFocus
  getSmartFocusByPlayer(playerId: string): Promise<SmartFocus[]>;
  createSmartFocus(sf: InsertSmartFocus): Promise<SmartFocus>;
  // Attendance
  getAttendanceSessions(teamId?: string): Promise<AttendanceSession[]>;
  getAttendanceSession(id: string): Promise<AttendanceSession | undefined>;
  createAttendanceSession(session: InsertAttendanceSession): Promise<AttendanceSession>;
  getAttendanceRecords(sessionId: string): Promise<AttendanceRecord[]>;
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  getPlayerAbsentCount(playerId: string, since: string): Promise<number>;
  getAttendanceRecordsByPlayer(playerId: string): Promise<AttendanceRecord[]>;
  // Discipline
  getDisciplineCases(playerId?: string): Promise<DisciplineCase[]>;
  createDisciplineCase(dc: InsertDisciplineCase): Promise<DisciplineCase>;
  // Finance
  getFinanceTxns(): Promise<FinanceTxn[]>;
  createFinanceTxn(txn: InsertFinanceTxn): Promise<FinanceTxn>;
  deleteFinanceTxn(id: string): Promise<void>;
  // Injuries
  getInjuries(): Promise<Injury[]>;
  getInjury(id: string): Promise<Injury | undefined>;
  getInjuriesByPlayer(playerId: string): Promise<Injury[]>;
  createInjury(injury: InsertInjury): Promise<Injury>;
  updateInjury(id: string, data: Partial<InsertInjury>): Promise<Injury | undefined>;
  // Awards
  getAwards(): Promise<Award[]>;
  getAwardsByPlayer(playerId: string): Promise<Award[]>;
  createAward(award: InsertAward): Promise<Award>;
}

export class DatabaseStorage implements IStorage {
  // Users
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

  // Teams
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

  // Players
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

  // Matches
  async getMatches() { return db.select().from(schema.matches).orderBy(desc(schema.matches.matchDate)); }
  async getMatch(id: string) {
    const [match] = await db.select().from(schema.matches).where(eq(schema.matches.id, id));
    return match;
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

  // Stats
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

  // SmartFocus
  async getSmartFocusByPlayer(playerId: string) {
    return db.select().from(schema.smartFocus).where(eq(schema.smartFocus.playerId, playerId));
  }
  async createSmartFocus(sf: InsertSmartFocus) {
    const [created] = await db.insert(schema.smartFocus).values(sf).returning();
    return created;
  }

  // Attendance
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

  // Discipline
  async getDisciplineCases(playerId?: string) {
    if (playerId) return db.select().from(schema.disciplineCases).where(eq(schema.disciplineCases.playerId, playerId));
    return db.select().from(schema.disciplineCases);
  }
  async createDisciplineCase(dc: InsertDisciplineCase) {
    const [created] = await db.insert(schema.disciplineCases).values(dc).returning();
    return created;
  }

  // Finance
  async getFinanceTxns() { return db.select().from(schema.financeTxns).orderBy(desc(schema.financeTxns.txnDate)); }
  async createFinanceTxn(txn: InsertFinanceTxn) {
    const [created] = await db.insert(schema.financeTxns).values(txn).returning();
    return created;
  }
  async deleteFinanceTxn(id: string) {
    await db.delete(schema.financeTxns).where(eq(schema.financeTxns.id, id));
  }

  // Injuries
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

  // Awards
  async getAwards() { return db.select().from(schema.awards); }
  async getAwardsByPlayer(playerId: string) {
    return db.select().from(schema.awards).where(eq(schema.awards.playerId, playerId));
  }
  async createAward(award: InsertAward) {
    const [created] = await db.insert(schema.awards).values(award).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
