# Afrocat Club Portal

## Overview
A full-stack management portal for the Afrocat Volleyball Club. Manages match stats, player performance, attendance, finance, injuries, awards, coach performance, player contracts, official documents (O-2bis), and more with role-based access control.

## Tech Stack
- **Frontend**: Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Routing**: wouter (frontend), Express (backend)
- **State**: TanStack React Query

## Project Structure
```
├── client/               # React frontend
│   ├── src/
│   │   ├── components/   # UI components (shadcn/ui + Layout)
│   │   ├── pages/        # Route pages (Login, Dashboard, Teams, Players, etc.)
│   │   ├── lib/          # API client, auth context, utilities
│   │   └── hooks/        # Custom React hooks
│   └── index.html
├── server/               # Express backend
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # All REST API routes
│   ├── storage.ts        # Database storage layer (Drizzle)
│   ├── auth.ts           # JWT auth + RBAC middleware
│   ├── db.ts             # Database connection
│   └── seed.ts           # Seed script for demo data
├── shared/
│   └── schema.ts         # Drizzle ORM schema (all entities)
└── drizzle.config.ts     # Drizzle Kit configuration
```

## Key Entities
Users, Teams, Players (with full biodata), Matches, PlayerMatchStats, SmartFocus, AttendanceSessions, AttendanceRecords, DisciplineCases, FinanceTxns, Injuries, Awards, ScoutingReports, CoachAssignments, CoachPerformanceSnapshots, PlayerContracts, TeamOfficials, MatchDocuments, MatchSquads, MatchSquadEntries, PlayerReports, PlayerDocuments

## RBAC Roles
- **Admin/Manager**: Full access to all modules, add/edit players, generate profile PDFs
- **Coach**: Teams, players, matches, attendance, stats, awards, contracts (read), documents
- **Statistician**: Matches, stats entry, reports
- **Finance**: Finance module only + read-only lists
- **Medical**: Injury module only + read-only lists
- **Player**: Self-registration, own profile (GET/PUT /api/players/me), own player dashboard, profile PDF for self

## Demo Credentials (all use password: Passw0rd!)
- admin@afrocat.test (Admin)
- manager@afrocat.test (Manager)
- coach@afrocat.test (Coach)
- stats@afrocat.test (Statistician)
- finance@afrocat.test (Finance)
- medical@afrocat.test (Medical)
- player1@afrocat.test (Player)

## Running
- `npm run dev` — starts both server and client on port 5000
- `npx tsx server/seed.ts` — seeds demo data
- `npm run db:push` — pushes schema to database

## Business Logic
- **Smart Focus Engine**: Auto-generates training recommendations on stats submit
- **Attendance Discipline**: Auto-creates warning if player has 3+ absences in 30 days
- **Injury Workflow**: Logging injury sets player status to INJURED; clearance resets to ACTIVE
- **Efficiency Score**: Computed from stats on submit (kills, aces, blocks, digs, assists minus errors)
- **Coach Performance & Stars**: Auto-computed from match results for assigned HEAD_COACHes. Stars: 1 (<30%), 2 (30-44%), 3 (45-59%), 4 (60-74%), 5 (>=75%). Provisional badge if <5 matches.
- **Player Contracts**: Full lifecycle — DRAFT → ACTIVE (via approve) → EXPIRED/TERMINATED. Contract termination sets player status to SUSPENDED_CONTRACT. Renewal warning when ≤60 days to expiry.
- **O-2bis Form Generation**: Server generates official team composition forms with club header, player roster, officials table, and approval signatures. Stored as MatchDocuments with metadata.
- **Starting 12 Squad Selector**: Per-match squad selection with eligibility validation. Checks: ACTIVE status, no open injuries, valid active contract, eligibilityStatus field. Server-side enforcement on save. Max 12 players. UI integrated into Matches page with ineligibility badges.
- **Coach Assignment Trigger**: Creating/updating matches with results auto-recomputes performance for the HEAD_COACH assigned to that team.
- **Enter Stats (World-Class UI)**: Branded stat entry page with Afrocat logo/motto, match meta display, player cards with circular photo/avatar, jersey number badges, position badges, color-coded stat category groups (Attack/Serve/Block/Receive/Defense/Setting) with +/- increment buttons, live pointsTotal and error totals per player and per team, post-save summary panel with top performers and SmartFocus count. Edit mode pre-loads existing stats.
- **Coach Dashboard Sync**: GET /api/dashboard/coach/summary?teamId= returns last 5 matches, team totals for latest match, top 5 performers, error leaders, SmartFocus highlights. Dashboard page shows Performance Insights section with team selector.
- **Player Dashboard**: GET /api/players/:playerId/dashboard returns last 10 match stats with match context, performance trend, SmartFocus history, attendance summary, injury status, active contract. RBAC: coach+ can view any player, player can view only self.
- **Match Report PDF**: POST /api/reports/match/:matchId/pdf generates branded HTML match report (club header, match info, result, team totals, top performers, error leaders, SmartFocus summary, full player stats table). Stored as MatchDocument with MATCH_REPORT type. Creates PlayerReport per player. Reports page has generate + view/print functionality.
- **Player Self-Registration**: POST /api/auth/register creates User(PLAYER) + Player record linked via user.playerId. Registration page at /register. On register, redirected to /profile-setup for onboarding wizard.
- **Player Bio Data**: Extended player schema with: email, homeAddress, town, region, nationality, idNumber, nextOfKinName/Relation/Phone/Address, emergencyContactName/Phone, medicalNotes, allergies, bloodGroup. Player form (admin) uses tabbed UI (Identity/Contact/Kin/Medical). Player self-edit via PUT /api/players/me (restricted fields, no team/status/jersey).
- **Player Profile PDF**: POST /api/players/:id/profile/pdf generates branded HTML profile document with personal info, contacts, next of kin, emergency, medical, team info, signature lines. Stored as PlayerDocument. RBAC: admin/manager/coach can generate for any, player can generate for self only.
- **Player Documents**: playerDocuments table (PLAYER_PROFILE, CONTRACT, MEDICAL_CLEARANCE types). GET /api/player-documents/:playerId.

## Brand
- Primary: teal (174 100% 29%), Accent: gold (45 100% 51%)
- Logo: `@assets/afrocate_logo_1772226294597.png`
- Club: AFROCAT VOLLEYBALL CLUB — One Team One Dream — Passion Discipline Victory
