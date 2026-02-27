export const mockUser = {
  id: "u1",
  fullName: "Admin User",
  email: "admin@afrocat.club",
  role: "Admin",
};

export const mockTeams = [
  { id: "t1", name: "Afrocat Men A", category: "MEN", season: "2023/2024" },
  { id: "t2", name: "Afrocat Women A", category: "WOMEN", season: "2023/2024" },
  { id: "t3", name: "Afrocat Juniors", category: "JUNIORS", season: "2023/2024" },
];

export const mockPlayers = [
  { id: "p1", teamId: "t1", firstName: "James", lastName: "Smith", position: "Setter", status: "ACTIVE", jerseyNo: 9, gender: "Male", phone: "+123456789", dob: "1998-05-12" },
  { id: "p2", teamId: "t1", firstName: "Michael", lastName: "Johnson", position: "Outside Hitter", status: "ACTIVE", jerseyNo: 12, gender: "Male", phone: "+123456780", dob: "2000-02-20" },
  { id: "p3", teamId: "t1", firstName: "Robert", lastName: "Williams", position: "Middle Blocker", status: "INJURED", jerseyNo: 15, gender: "Male", phone: "+123456781", dob: "1999-11-05" },
  { id: "p4", teamId: "t2", firstName: "Maria", lastName: "Garcia", position: "Libero", status: "ACTIVE", jerseyNo: 5, gender: "Female", phone: "+123456782", dob: "2001-08-14" },
  { id: "p5", teamId: "t2", firstName: "Sarah", lastName: "Martinez", position: "Opposite", status: "ACTIVE", jerseyNo: 7, gender: "Female", phone: "+123456783", dob: "1997-04-30" },
  { id: "p6", teamId: "t3", firstName: "David", lastName: "Rodriguez", position: "Setter", status: "ACTIVE", jerseyNo: 2, gender: "Male", phone: "+123456784", dob: "2005-09-11" },
  { id: "p7", teamId: "t3", firstName: "Richard", lastName: "Hernandez", position: "Middle Blocker", status: "SUSPENDED", jerseyNo: 14, gender: "Male", phone: "+123456785", dob: "2006-01-25" },
  { id: "p8", teamId: "t1", firstName: "William", lastName: "Lopez", position: "Libero", status: "ACTIVE", jerseyNo: 1, gender: "Male", phone: "+123456786", dob: "1996-12-08" },
];

export const mockMatches = [
  { id: "m1", teamId: "t1", opponent: "Eagles VC", matchDate: "2024-03-10", venue: "Home", competition: "National League", result: "W", setsFor: 3, setsAgainst: 1 },
  { id: "m2", teamId: "t2", opponent: "Panthers VC", matchDate: "2024-03-12", venue: "Away", competition: "Regional Cup", result: "L", setsFor: 2, setsAgainst: 3 },
  { id: "m3", teamId: "t1", opponent: "Lions VC", matchDate: "2024-03-18", venue: "Home", competition: "National League", result: "W", setsFor: 3, setsAgainst: 0 },
];

export const mockInjuries = [
  { id: "i1", playerId: "p3", injuryType: "Ankle Sprain", severity: "MEDIUM", startDate: "2024-03-01", status: "OPEN" },
  { id: "i2", playerId: "p8", injuryType: "Knee Pain", severity: "LOW", startDate: "2024-02-15", status: "CLEARED" },
];

export const mockFinances = [
  { id: "f1", txnDate: "2024-03-01", type: "INCOME", category: "Sponsorship", amount: 5000, description: "Local Gym Sponsor" },
  { id: "f2", txnDate: "2024-03-05", type: "EXPENSE", category: "Equipment", amount: 450, description: "New Volleyballs" },
  { id: "f3", txnDate: "2024-03-10", type: "INCOME", category: "Membership Dues", amount: 1200, description: "March dues" },
  { id: "f4", txnDate: "2024-03-12", type: "EXPENSE", category: "Travel", amount: 300, description: "Bus rental for away match" },
];

export const mockSmartFocus = [
  { id: "sf1", playerId: "p1", matchId: "m1", focusAreas: ["Setting accuracy", "Serve reception consistency"], generatedAt: "2024-03-11" },
  { id: "sf2", playerId: "p2", matchId: "m1", focusAreas: ["Attack control", "Blocking timing"], generatedAt: "2024-03-11" },
];
