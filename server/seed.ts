import { db } from "./db";
import * as schema from "@shared/schema";
import { hashPassword } from "./auth";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  const existingUsers = await db.select().from(schema.users).limit(1);
  if (existingUsers.length > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  const hash = await hashPassword("Passw0rd!");

  const [menTeam] = await db.insert(schema.teams).values({ name: "Afrocat Men A", category: "MEN", season: "2024/2025" }).returning();
  const [womenTeam] = await db.insert(schema.teams).values({ name: "Afrocat Women A", category: "WOMEN", season: "2024/2025" }).returning();

  const playerData = [
    { teamId: menTeam.id, firstName: "James", lastName: "Okonkwo", gender: "Male", jerseyNo: 9, position: "Setter", dob: "1998-05-12", phone: "+27123456701" },
    { teamId: menTeam.id, firstName: "Michael", lastName: "Ndaba", gender: "Male", jerseyNo: 12, position: "Outside Hitter", dob: "2000-02-20", phone: "+27123456702" },
    { teamId: menTeam.id, firstName: "Robert", lastName: "Mensah", gender: "Male", jerseyNo: 15, position: "Middle Blocker", dob: "1999-11-05", phone: "+27123456703" },
    { teamId: menTeam.id, firstName: "William", lastName: "Adekunle", gender: "Male", jerseyNo: 1, position: "Libero", dob: "1996-12-08", phone: "+27123456704" },
    { teamId: womenTeam.id, firstName: "Maria", lastName: "Dlamini", gender: "Female", jerseyNo: 5, position: "Libero", dob: "2001-08-14", phone: "+27123456705" },
    { teamId: womenTeam.id, firstName: "Sarah", lastName: "Moyo", gender: "Female", jerseyNo: 7, position: "Opposite", dob: "1997-04-30", phone: "+27123456706" },
    { teamId: womenTeam.id, firstName: "Lisa", lastName: "Khumalo", gender: "Female", jerseyNo: 3, position: "Setter", dob: "2002-06-18", phone: "+27123456707" },
    { teamId: womenTeam.id, firstName: "Thandi", lastName: "Ngcobo", gender: "Female", jerseyNo: 10, position: "Middle Blocker", dob: "2000-09-22", phone: "+27123456708" },
  ];

  const players = [];
  for (const p of playerData) {
    const [created] = await db.insert(schema.players).values(p).returning();
    players.push(created);
  }

  const [coachUser] = await db.insert(schema.users).values({
    fullName: "Coach User", email: "coach@afrocat.test", passwordHash: hash, role: "COACH", teamId: menTeam.id,
    emailVerified: true, accountStatus: "ACTIVE",
  }).returning();

  await db.insert(schema.users).values([
    { fullName: "Admin User", email: "admin@afrocat.test", passwordHash: hash, role: "ADMIN", emailVerified: true, accountStatus: "ACTIVE" },
    { fullName: "Manager User", email: "manager@afrocat.test", passwordHash: hash, role: "MANAGER", emailVerified: true, accountStatus: "ACTIVE" },
    { fullName: "Stats User", email: "stats@afrocat.test", passwordHash: hash, role: "STATISTICIAN", emailVerified: true, accountStatus: "ACTIVE" },
    { fullName: "Finance User", email: "finance@afrocat.test", passwordHash: hash, role: "FINANCE", emailVerified: true, accountStatus: "ACTIVE" },
    { fullName: "Medical User", email: "medical@afrocat.test", passwordHash: hash, role: "MEDICAL", emailVerified: true, accountStatus: "ACTIVE" },
    { fullName: "James Okonkwo", email: "player1@afrocat.test", passwordHash: hash, role: "PLAYER", playerId: players[0].id, teamId: menTeam.id, emailVerified: true, accountStatus: "ACTIVE" },
  ]);

  await db.insert(schema.systemSecuritySettings).values({
    id: "security",
    requireEmailVerification: true,
    requireAdminApproval: true,
    autoApproveTeamRequests: false,
    autoApprovePosition: false,
    autoApproveJersey: false,
  }).onConflictDoNothing();

  const [match1] = await db.insert(schema.matches).values({
    teamId: menTeam.id, opponent: "Eagles VC", matchDate: "2024-03-10",
    venue: "Home", competition: "National League", result: "W", setsFor: 3, setsAgainst: 1,
  }).returning();

  await db.insert(schema.matches).values([
    { teamId: menTeam.id, opponent: "Lions VC", matchDate: "2024-03-17", venue: "Away", competition: "National League", result: "W", setsFor: 3, setsAgainst: 0 },
    { teamId: menTeam.id, opponent: "Thunder VC", matchDate: "2024-03-24", venue: "Home", competition: "National League", result: "L", setsFor: 1, setsAgainst: 3 },
    { teamId: menTeam.id, opponent: "Hawks VC", matchDate: "2024-03-31", venue: "Away", competition: "Regional Cup", result: "W", setsFor: 3, setsAgainst: 2 },
    { teamId: menTeam.id, opponent: "Storm VC", matchDate: "2024-04-07", venue: "Home", competition: "National League", result: "W", setsFor: 3, setsAgainst: 1 },
    { teamId: menTeam.id, opponent: "Wolves VC", matchDate: "2024-04-14", venue: "Away", competition: "National League", result: "W", setsFor: 3, setsAgainst: 0 },
    { teamId: menTeam.id, opponent: "Rhinos VC", matchDate: "2024-04-21", venue: "Home", competition: "National League", result: "L", setsFor: 2, setsAgainst: 3 },
  ]);

  const [match2] = await db.insert(schema.matches).values({
    teamId: womenTeam.id, opponent: "Panthers VC", matchDate: "2024-03-12",
    venue: "Away", competition: "Regional Cup", result: "L", setsFor: 2, setsAgainst: 3,
  }).returning();

  for (const player of players.slice(0, 4)) {
    const stats = {
      matchId: match1.id, playerId: player.id,
      spikesKill: Math.floor(Math.random() * 10),
      spikesError: Math.floor(Math.random() * 5),
      servesAce: Math.floor(Math.random() * 4),
      servesError: Math.floor(Math.random() * 4),
      blocksSolo: Math.floor(Math.random() * 3),
      blocksAssist: Math.floor(Math.random() * 4),
      receivePerfect: Math.floor(Math.random() * 8),
      receiveError: Math.floor(Math.random() * 4),
      digs: Math.floor(Math.random() * 6),
      settingAssist: Math.floor(Math.random() * 8),
      settingError: Math.floor(Math.random() * 3),
      minutesPlayed: 60 + Math.floor(Math.random() * 30),
    };
    const pt = (stats.spikesKill*2)+(stats.servesAce*2)+(stats.blocksSolo*2)+stats.blocksAssist+stats.digs+stats.settingAssist
      -(stats.spikesError*2)-(stats.servesError*2)-(stats.receiveError*2)-(stats.settingError*2);
    await db.insert(schema.playerMatchStats).values({ ...stats, pointsTotal: pt });
  }

  const [session1] = await db.insert(schema.attendanceSessions).values({
    teamId: menTeam.id, sessionDate: "2024-03-08", sessionType: "TRAINING", notes: "Pre-match training",
  }).returning();

  for (const player of players.slice(0, 4)) {
    await db.insert(schema.attendanceRecords).values({
      sessionId: session1.id, playerId: player.id, status: "PRESENT",
    });
  }

  await db.insert(schema.financeTxns).values([
    { txnDate: "2024-03-01", type: "INCOME", category: "Sponsorship", amount: 5000, description: "Local Gym Sponsor" },
    { txnDate: "2024-03-05", type: "EXPENSE", category: "Equipment", amount: 450, description: "New Volleyballs" },
    { txnDate: "2024-03-10", type: "INCOME", category: "Membership Dues", amount: 1200, description: "March dues" },
    { txnDate: "2024-03-12", type: "EXPENSE", category: "Travel", amount: 300, description: "Bus rental for away match" },
  ]);

  await db.insert(schema.injuries).values([
    { playerId: players[2].id, injuryType: "Ankle Sprain", severity: "MEDIUM", startDate: "2024-03-01", status: "OPEN" },
    { playerId: players[3].id, injuryType: "Knee Pain", severity: "LOW", startDate: "2024-02-15", status: "CLEARED", clearanceNote: "Fully recovered" },
  ]);

  await db.update(schema.players).set({ status: "INJURED" }).where(sql`${schema.players.id} = ${players[2].id}`);

  await db.insert(schema.awards).values([
    { playerId: players[0].id, awardType: "MVP", awardMonth: "2024-03", notes: "Outstanding setting performance" },
    { playerId: players[1].id, awardType: "MOST_IMPROVED", awardMonth: "2024-03" },
  ]);

  await db.insert(schema.coachAssignments).values({
    coachUserId: coachUser.id, teamId: menTeam.id,
    assignmentRole: "HEAD_COACH", startDate: "2024-01-01", active: true,
  });

  const winRate = 5 / 7;
  const stars = winRate >= 0.75 ? 5 : winRate >= 0.60 ? 4 : winRate >= 0.45 ? 3 : winRate >= 0.30 ? 2 : 1;
  await db.insert(schema.coachPerformanceSnapshots).values({
    coachUserId: coachUser.id, matches: 7, wins: 5,
    winRate: Math.round(winRate * 100) / 100, stars,
  });

  await db.insert(schema.playerContracts).values({
    playerId: players[0].id, contractType: "PERMANENT",
    startDate: "2024-01-01", endDate: "2025-06-30",
    signOnFee: 500, weeklyTransport: 50, salaryAmount: 0,
    obligations: "Training attendance minimum 80%. Match availability required.",
    status: "ACTIVE", createdByUserId: coachUser.id,
  });

  await db.insert(schema.teamOfficials).values([
    { teamId: menTeam.id, role: "HEAD_COACH", name: "Coach User" },
    { teamId: menTeam.id, role: "TEAM_MANAGER", name: "Manager User" },
    { teamId: menTeam.id, role: "PHYSIOTHERAPIST", name: "Dr. Physio" },
  ]);

  console.log("Seed complete!");
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
