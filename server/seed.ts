import { db } from "./db";
import * as schema from "@shared/schema";
import { hashPassword } from "./auth";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Check if already seeded
  const existingUsers = await db.select().from(schema.users).limit(1);
  if (existingUsers.length > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  const hash = await hashPassword("Passw0rd!");

  // Teams
  const [menTeam] = await db.insert(schema.teams).values({ name: "Afrocat Men A", category: "MEN", season: "2024/2025" }).returning();
  const [womenTeam] = await db.insert(schema.teams).values({ name: "Afrocat Women A", category: "WOMEN", season: "2024/2025" }).returning();

  // Players
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

  // Users (demo accounts)
  await db.insert(schema.users).values([
    { fullName: "Admin User", email: "admin@afrocat.test", passwordHash: hash, role: "ADMIN" },
    { fullName: "Manager User", email: "manager@afrocat.test", passwordHash: hash, role: "MANAGER" },
    { fullName: "Coach User", email: "coach@afrocat.test", passwordHash: hash, role: "COACH", teamId: menTeam.id },
    { fullName: "Stats User", email: "stats@afrocat.test", passwordHash: hash, role: "STATISTICIAN" },
    { fullName: "Finance User", email: "finance@afrocat.test", passwordHash: hash, role: "FINANCE" },
    { fullName: "Medical User", email: "medical@afrocat.test", passwordHash: hash, role: "MEDICAL" },
    { fullName: "James Okonkwo", email: "player1@afrocat.test", passwordHash: hash, role: "PLAYER", playerId: players[0].id, teamId: menTeam.id },
  ]);

  // Matches
  const [match1] = await db.insert(schema.matches).values({
    teamId: menTeam.id, opponent: "Eagles VC", matchDate: "2024-03-10",
    venue: "Home", competition: "National League", result: "W", setsFor: 3, setsAgainst: 1,
  }).returning();

  const [match2] = await db.insert(schema.matches).values({
    teamId: womenTeam.id, opponent: "Panthers VC", matchDate: "2024-03-12",
    venue: "Away", competition: "Regional Cup", result: "L", setsFor: 2, setsAgainst: 3,
  }).returning();

  // Stats for match1 - men team
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

  // Attendance
  const [session1] = await db.insert(schema.attendanceSessions).values({
    teamId: menTeam.id, sessionDate: "2024-03-08", sessionType: "TRAINING", notes: "Pre-match training",
  }).returning();

  for (const player of players.slice(0, 4)) {
    await db.insert(schema.attendanceRecords).values({
      sessionId: session1.id, playerId: player.id, status: "PRESENT",
    });
  }

  // Finance
  await db.insert(schema.financeTxns).values([
    { txnDate: "2024-03-01", type: "INCOME", category: "Sponsorship", amount: 5000, description: "Local Gym Sponsor" },
    { txnDate: "2024-03-05", type: "EXPENSE", category: "Equipment", amount: 450, description: "New Volleyballs" },
    { txnDate: "2024-03-10", type: "INCOME", category: "Membership Dues", amount: 1200, description: "March dues" },
    { txnDate: "2024-03-12", type: "EXPENSE", category: "Travel", amount: 300, description: "Bus rental for away match" },
  ]);

  // Injuries
  await db.insert(schema.injuries).values([
    { playerId: players[2].id, injuryType: "Ankle Sprain", severity: "MEDIUM", startDate: "2024-03-01", status: "OPEN" },
    { playerId: players[3].id, injuryType: "Knee Pain", severity: "LOW", startDate: "2024-02-15", status: "CLEARED", clearanceNote: "Fully recovered" },
  ]);

  // Update injured player status
  await db.update(schema.players).set({ status: "INJURED" }).where(sql`${schema.players.id} = ${players[2].id}`);

  // Awards
  await db.insert(schema.awards).values([
    { playerId: players[0].id, awardType: "MVP", awardMonth: "2024-03", notes: "Outstanding setting performance" },
    { playerId: players[1].id, awardType: "MOST_IMPROVED", awardMonth: "2024-03" },
  ]);

  console.log("Seed complete!");
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
