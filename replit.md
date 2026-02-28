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
Users, Teams, Players (with full biodata), Matches, PlayerMatchStats, SmartFocus, AttendanceSessions, AttendanceRecords, DisciplineCases, FinanceTxns, Injuries, Awards, ScoutingReports, CoachAssignments, CoachPerformanceSnapshots, PlayerContracts, ContractIssuedItems, ContractTransportBenefits, NvfTransferFeeSchedules, PlayerTransferCases, TeamOfficials, MatchDocuments, MatchSquads, MatchSquadEntries, PlayerReports, PlayerDocuments

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
- **Player Contracts**: Full lifecycle — DRAFT → ACTIVE (via approve) → EXPIRED/TERMINATED. Contract termination sets player status to SUSPENDED_CONTRACT. Renewal warning when ≤60 days to expiry. Extended with: releaseFee, membershipFee (required/paid), developmentFee (required/paid), currency (default NAD).
- **Contract Items Issued**: Track items given to players (item name, qty, unit value, auto-computed total). CRUD endpoints: GET/POST /contracts/:id/items, PUT/DELETE /contracts/items/:itemId.
- **Contract Transport Benefits**: Track transport benefits (type: TRAINING/MATCH/OTHER, frequency: ONE_TIME/WEEKLY/MONTHLY/PER_TRIP, amount, date range). Value auto-computed based on frequency and date range.
- **NVF Transfer Fee Schedule**: Yearly configurable NVF fees (Admin only). INTER_ASSOCIATION_TRANSFER_FEE or OTHER type. Used by transfer calculator.
- **Transfer Calculator**: POST /api/transfers/calculate computes total transfer amount due: nvfFee + releaseFee (capped at N$3,000 per NVF rule) + itemsValue + transportValue + membershipOutstanding + developmentOutstanding. POST /api/transfers creates a saved PlayerTransferCase (status: DRAFT→CONFIRMED→PAID→CLOSED).
- **Contract Investment Summary PDF**: POST /api/contracts/:id/investment-pdf generates branded HTML showing all items, transport, fees, and grand total.
- **Transfer Fee Breakdown PDF**: POST /api/transfers/:id/pdf generates branded HTML breakdown of transfer components.
- **O-2bis Form Generation**: Server generates official team composition forms with club header, player roster, officials table, and approval signatures. Stored as MatchDocuments with metadata.
- **Starting 12 Squad Selector**: Per-match squad selection with eligibility validation. Checks: ACTIVE status, no open injuries, valid active contract, eligibilityStatus field. Server-side enforcement on save. Max 12 players. UI integrated into Matches page with ineligibility badges.
- **Coach Assignment Trigger**: Creating/updating matches with results auto-recomputes performance for the HEAD_COACH assigned to that team.
- **Enter Stats (World-Class UI)**: Branded stat entry page with Afrocat logo/motto, match meta display, player cards with circular photo/avatar, jersey number badges, position badges, color-coded stat category groups (Attack/Serve/Block/Receive/Defense/Setting) with +/- increment buttons, live pointsTotal and error totals per player and per team, post-save summary panel with top performers and SmartFocus count. Edit mode pre-loads existing stats.
- **Coach Dashboard Sync**: GET /api/dashboard/coach/summary?teamId= returns last 5 matches, team totals for latest match, top 5 performers, error leaders, SmartFocus highlights. Dashboard page shows Performance Insights section with team selector.
- **Player Dashboard (FIFA-Style Dark UI)**: GET /api/players/:playerId/dashboard returns player profile (with teamName), career totals, last 10 match stats with match context (incl. isHome), performance trend, SmartFocus history, attendance summary, injury status, active contract, upcoming fixture (with coach name). UI: Premium dark theme (.afrocat-dark CSS class) with Afrocat teal/gold palette, Recharts bar+line charts, All/Home/Away filter, player profile card with photo/avatar, jersey/position/status badges, stat totals grid, upcoming fixture card, tabbed content (Overview, Smart Focus, Attendance, Injury & Wellness, Match Stats). RBAC: coach+ can view any player via selector, player can view only self.
- **Match Report PDF**: POST /api/reports/match/:matchId/pdf generates branded HTML match report (club header, match info, result, team totals, top performers, error leaders, SmartFocus summary, full player stats table). Stored as MatchDocument with MATCH_REPORT type. Creates PlayerReport per player. Reports page has generate + view/print functionality.
- **Player Self-Registration**: POST /api/auth/register creates User(PLAYER) + Player record linked via user.playerId with email verification + admin approval workflow. Registration page at /register with team/position/jersey request fields. Email verification via /verify-email. Admin registration management at /admin/registrations with security settings (require email verification, require admin approval, auto-approve toggles). Account statuses: PENDING_APPROVAL → ACTIVE (or SUSPENDED/REJECTED). Seeded users have emailVerified=true, accountStatus=ACTIVE.
- **Player Bio Data**: Extended player schema with: email, homeAddress, town, region, nationality, idNumber, nextOfKinName/Relation/Phone/Address, emergencyContactName/Phone, medicalNotes, allergies, bloodGroup. Player form (admin) uses tabbed UI (Identity/Contact/Kin/Medical). Player self-edit via PUT /api/players/me (restricted fields, no team/status/jersey).
- **Player Profile PDF**: POST /api/players/:id/profile/pdf generates branded HTML profile document with personal info, contacts, next of kin, emergency, medical, team info, signature lines. Stored as PlayerDocument. RBAC: admin/manager/coach can generate for any, player can generate for self only.
- **Player Documents**: playerDocuments table (PLAYER_PROFILE, CONTRACT, MEDICAL_CLEARANCE types). GET /api/player-documents/:playerId.

- **Password Reset Flow (Admin-Only)**: Admin can reset any user's password via /admin/users page. Two methods: TEMP_PASSWORD (sets password + mustChangePassword flag) or ONE_TIME_LINK (generates 1-hour expiry token link to /reset-password). Login returns mustChangePassword flag; ProtectedRoute enforces redirect to /change-password. After successful change, user is redirected to dashboard. POST /api/admin/users/:userId/reset-password, POST /api/auth/change-password, POST /api/auth/reset-password. Password reset audits stored in passwordResetAudits table.
- **Permanent Admin Provisioning**: Run `npx tsx server/scripts/ensureAdmin.ts` with ADMIN_EMAIL + ADMIN_PASSWORD env vars to create/update permanent admin account. ADMIN_EMAIL=mosesmukisa1@gmail.com.

## GitHub Repository
- **Repo**: https://github.com/mosesmukisa1-a11y/afrocat-club-portal
- **Branch**: main
- **Last push**: Afrocat Portal Production Version
- **GitHub Integration**: Uses Replit GitHub connector (server/github.ts)

## Brand & Theme
- Primary: teal `#0F8B7D` (174 80% 30%), Accent: gold `#F2B705` (45 100% 49%)
- Logo: `@assets/afrocate_logo_1772226294597.png`
- Club: AFROCAT VOLLEYBALL CLUB — One Team One Dream — Passion Discipline Victory
- **Global Dark Theme**: Entire app uses Afrocat dark palette. Tailwind v4 `@theme inline` block defines `ac-*` tokens (ac-teal, ac-gold, ac-bg, ac-card, ac-text, ac-muted, ac-border, ac-green, ac-red, etc.). `:root` HSL variables set to dark values for shadcn components. CSS utilities: `.afrocat-page` (radial gradient glows), `.afrocat-card` / `.ac-card` (gradient card). Global html/body bg: `#0B0F14`. Gold selection highlight, gold scrollbar thumb. Layout sidebar uses dark card bg.
- **Note**: Some secondary pages (Finance, Injuries, Contracts, Coaches, Matches, Reports, Players, Documents, AdminUsers) still use generic Tailwind color classes (bg-green-100, etc.) — these should be migrated to `ac-*` tokens for full consistency.
