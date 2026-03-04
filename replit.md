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
│   └── seed.ts           # Seed script (mock data removed from DB)
├── shared/
│   └── schema.ts         # Drizzle ORM schema (all entities)
└── drizzle.config.ts     # Drizzle Kit configuration
```

## Camera / Photo Upload
- **CameraCapture component** (`client/src/components/CameraCapture.tsx`): Shared component for photo capture with three options:
  - Front camera (selfie mode, `facingMode: "user"`)
  - Back camera (`facingMode: "environment"`) with switch toggle
  - Gallery upload (file picker, image cropped to 400x400 square, JPEG 80% quality, max 5MB)
- Used in: Register.tsx (required photo), Players.tsx (player photo), ProfileSetup.tsx (profile photo)

## Key Entities
Users, Teams, Players (with full biodata + heightCm, weightKg, lastWeightUpdatedAt), Matches, PlayerMatchStats, SmartFocus, AttendanceSessions, AttendanceRecords, DisciplineCases, FinanceTxns, Injuries, Awards, ScoutingReports, CoachAssignments, CoachPerformanceSnapshots, PlayerContracts, ContractIssuedItems, ContractTransportBenefits, NvfTransferFeeSchedules, PlayerTransferCases, TeamOfficials, MatchDocuments, MatchSquads, MatchSquadEntries, PlayerReports, PlayerDocuments, ShopItems, MediaPosts, MediaTags, MediaTagRequests, MatchEvents, PlayerUpdateRequests

## RBAC Roles
- **Super Admin**: mosesmukisa1@gmail.com — only user who can assign roles to others. Flagged via `isSuperAdmin` in DB.
- **Multi-Role Support**: Users can have multiple roles (stored in `roles` text[] column). The `role` column holds the primary role. JWT includes `roles[]`. Sidebar, `requireRole` middleware, and route guards check the full `roles` array.
- **Role Switcher**: Users with multiple roles see a "Switch Role" button in the sidebar. Switching changes `activeRole` (persisted in localStorage per user), updates `user.role` in auth context, filters nav items to the active role's scope, and redirects to Dashboard. Super admins always see all nav items regardless of active role.
- **Admin/Manager**: Full access to all modules, add/edit/delete players, generate profile PDFs, manage shop/media
- **Coach**: Teams, players, matches, attendance, stats, awards, contracts (read), documents
- **Captain**: View players/teams, contact players by email/phone. Assigned as additional role via User Management (not self-registered)
- **Statistician**: Matches, stats entry, reports
- **Finance**: Finance module only + read-only lists
- **Medical**: Injury module only + read-only lists
- **Player**: Self-registration, own profile (GET/PUT /api/players/me), own player dashboard, profile PDF for self

## Admin Account
- **Super Admin**: mosesmukisa1@gmail.com (uses ADMIN_PASSWORD secret, `isSuperAdmin: true`)
- **Provisioning**: Auto-provisioned on every server startup via `server/index.ts`

## Running
- `npm run dev` — starts both server and client on port 5000
- `npm run db:push` — pushes schema to database

## Business Logic
- **Smart Focus Engine**: Auto-generates training recommendations on stats submit
- **Attendance Discipline**: Auto-creates warning if player has 3+ absences in 30 days
- **Injury Workflow**: Logging injury sets player status to INJURED; clearance resets to ACTIVE
- **Efficiency Score**: Computed from stats on submit (kills, aces, blocks, digs, assists minus errors)
- **Coach Performance & Stars**: Auto-computed from match results for assigned HEAD_COACHes
- **Player Contracts**: Full lifecycle — DRAFT → ACTIVE → EXPIRED/TERMINATED
- **Club Contract (PDF-Based)**: Official Afrocat Application Form PDF embedded with pdf-lib. On acceptance, generates a signed PDF = original contract + appended confirmation page with player details, confirmation type (Self/Guardian), checkboxes, signatory details. Minors (<18) require guardian ID + phone. Signed PDFs stored at `public/contracts/signed/` and downloadable from ClubContract page. `signedPdfUrl` tracked in `contractAcceptances` table.
- **Player Delete (Admin)**: Cascade deletes stats, attendance, injuries, awards, contracts, smart focus
- **Forgot Password**: Self-service forgot password flow — generates reset link (no email service). `POST /api/auth/forgot-password` → token-based reset via `/reset-password`
- **Camera Capture**: Shared `CameraCapture` component (`client/src/components/CameraCapture.tsx`) used in both Registration and Admin Add Player forms. Captures photo via device camera with preview.
- **SoloStats Touch**: Event-based stat entry (`/touch-stats`). Tap Player → Action (Serve/Receive/Set/Attack/Block/Dig/Free Ball) → Outcome (+/0/−). Real-time feed with Undo. Locked state enforcement (statsEntered/scoreLocked/scoreSource). Server validates action/outcome enums, player-team association, match-event scoping. Roles: ADMIN, MANAGER, COACH, STATISTICIAN
- **Player Spotlight**: Dashboard shows a daily-rotating player profile with photo, position, team, age, physical stats, career volleyball stats (kills, aces, blocks, digs, assists, points), and awards. Rotates deterministically by day index. `GET /api/player-spotlight` picks from approved active players.
- **Motivational Messages**: Player dashboard shows auto-generated coaching tips based on attendance rate, performance trend, and error analysis
- **Media System**: Upload → PENDING_REVIEW → Admin approves. Player tag requests with admin approval workflow
- **Shop System**: Admin CRUD for merchandise, public display
- **Attendance Self-Check-In**: Players self-mark → coach confirms
- **Attendance Locking**: Save attendance auto-closes and locks the session (`status: CLOSED`, `lockedAt`, `lockedBy`). Once closed: no edits for coach/admin/players; UI shows "Attendance Closed" badge. Only Super Admin can edit locked sessions via "Edit Attendance" button. Backend enforces lock on all routes (POST records, POST save, checkin). Routes: `POST /api/attendance/sessions/:id/save` (save+close), `PATCH /api/attendance/sessions/:id` (super admin edit)
- **Team↔Gender Rules**: Afrocat D/C/E/V = MALE only; Afrocat Ladies/Titans = FEMALE only. Enforced in registration, profile edit, team approval. `TEAM_GENDER_RULES` in routes.ts. `GET /api/team-gender-rules` public endpoint. Frontend auto-fills gender from team, filters teams by gender.
- **Height/Weight**: Required on registration (heightCm, weightKg). Weight tracked with `lastWeightUpdatedAt`. Weight-only updates bypass approval for approved players.
- **Quarterly Weight Update**: Daily cron at 08:00 checks for overdue weight (>90 days). Creates WEIGHT_UPDATE notification per quarter (YYYY-Qx). Dashboard shows weight update warning with link to profile.
- **Admin Re-Approval Workflow**: After initial registration approval, profile edits create `PlayerUpdateRequest` (PENDING) instead of direct update. Admin reviews in "Profile Updates" tab of AdminRegistrations. Approve applies patchJson to player record. Reject with optional note. `playerUpdateRequests` table tracks all requests.

## Brand & Theme
- Primary: teal `#0F8B7D`, Accent: gold `#F2B705`
- Logo: `@assets/afrocate_logo_1772226294597.png`
- Club: AFROCAT VOLLEYBALL CLUB — One Team One Dream — Passion Discipline Victory
- **Global Dark Theme**: Full `afrocat-*` token system. `.afrocat-card` CSS class for card components.

## Match Scheduling Upgrade (Latest)
- **Admin Match Editing**: `PATCH /api/matches/:id` — admins can edit UPCOMING matches (not PLAYED/CANCELLED, not stats-entered/score-locked). Editable: startTime, venue, competition, round, notes, opponent.
- **Match Staff Assignments**: `matchStaffAssignments` table (headCoachUserId required, assistantCoachUserId, medicUserId, teamManagerUserId optional). `POST /api/matches/:id/staff` upsert, `GET /api/matches/:id/staff` retrieve.
- **Squad Selection Notifications**: When players are newly added to a match squad, they get a `MATCH_SELECTION` notification. Admins also notified of squad changes.
- **O2BIS Completeness Check**: `GET /api/docs/o2bis/:matchId/check` returns `{ok, canGenerate, missing[]}` — checks staff, squad, venue, startTime, competition.
- **O2BIS Unified PDF Generator**: `server/o2bis.ts` — single shared `generateO2BISPdf(storage, options)` function used by both Document Centre and Match Section. Both endpoints produce identical PDFs. Staff autofilled from `matchStaffAssignments`. Libero players marked with `(L)` in name field.
- **O2BIS PDF Download**: `GET /api/docs/o2bis/:matchId.pdf?skipMissing=true/false&teamId=...` — pdf-lib generated PDF with match info, staff section, player list, signatures. Missing fields shown as blanks when skipMissing=true. TeamId validated against match. Libero rule enforced before generation.
- **Libero Rule**: `matchSquadEntries.isLibero` boolean column. If squad >= 14 players, at least 2 must be marked as liberos. Frontend shows modal prompt with "Go Back" / "Auto-Select" options. `POST /api/matches/:matchId/squad/auto-select-liberos` auto-picks players with LIBERO position or lowest jersey numbers.
- **O2BIS Skip Modal**: Frontend shows missing info list with "Go Back & Fill" / "Skip & Generate" buttons. PDF downloaded via fetch+blob for JWT auth compatibility.
- **Staff-Eligible Users Endpoint**: `GET /api/staff-eligible-users` for ADMIN/MANAGER/COACH to populate staff assignment dropdowns.
- **Matches.tsx UI**: Edit button (ADMIN), Staff Assignment button, O2BIS generation button on upcoming match cards.
- **Touch Stats Sync**: `POST /api/matches/:matchId/stats-touch/sync` — aggregates all touch events into `playerMatchStats` table. Calculates pointsTotal, generates Smart Focus recommendations, marks match as statsEntered.

## Touch Stats Scoreboard Upgrade
- **Live Scoreboard**: Match header shows Points (P) + Sets Won (S) for Home/Away, Current Set Number, Scorer Name. Fields: `liveHomePoints`, `liveAwayPoints`, `homeSetsWon`, `awaySetsWon`, `currentSetNumber`, `scorerUserId`, `scoringStartedAt` on matches table.
- **Set Scoring**: "End Set — Home Wins" / "End Set — Away Wins" buttons. Increments sets, resets points to 0, advances set number. Max 5 sets.
- **Points**: Auto-attributed from stat events (ACE→home, KILL→home, STUFF→home, serve NET/OUT→away, attack OUT/BLOCKED→away, etc.). Manual "+1 Home" / "+1 Away" / "Undo Point" buttons.
- **Expanded Outcome Panels**: Step 3 now shows skill-specific outcome buttons (not just +/0/−). Each button shows outcome detail + point attribution.
  - SERVE: ACE, In Play, Net, Out
  - RECEIVE: Perfect, Positive, Off System, Error
  - SET: Perfect, Slightly Off, Out of System, Out, Net Touch, Double Touch, Lift
  - ATTACK: Kill, Tool Block, Dug, Blocked, Out, Net
  - BLOCK: Stuff Block, Touch, Block Out, Net Touch, Overreach, Error
  - DIG: Controlled, Not Controlled, Error
- **Setter Combinations**: After SET success (Perfect/Slightly Off), shows combo picker: ONE / ZERO / FAST_BALL / SKIP. Stored in `matchEvents.combinationType`.
- **New Event Fields**: `setNumber` (int), `combinationType` (text), `pointWonByTeamId` (varchar) on `matchEvents` table.
- **New Enums**: NET_TOUCH/OVERREACH/BLOCK_OUT for blocks, SET_OUT_OF_SYSTEM/SET_OUT/NET_TOUCH for sets, TOOL_BLOCK/BLOCK_OUT for attacks.
- **Endpoints**: `POST /api/matches/:matchId/scoreboard/point` (+1 side), `POST /api/matches/:matchId/scoreboard/undo-point`, `POST /api/matches/:matchId/scoreboard/end-set` (winner side). Events endpoint accepts `outcomeDetail`, `combinationType`, `pointSide`.

## Advanced Development Stats Platform
- **Dev Stats Page** (`/dev-stats`): Full development-focused stat tracking with detailed fields per skill type (Serve types, Receive ratings, Set quality, Attack outcomes, Block types, Dig types). Error classification (Technical/Decision/Pressure/Fatigue). Pressure + Fatigue flags. Zones, tactical intentions, notes.
- **Schema**: `matchEvents` table extended with: `rotation`, `subType`, `zone`, `tempo`, `outcomeDetail`, `errorCategory`, `errorType`, `pressureFlag`, `fatigueFlag`, `tacticalIntention`, `notes`.
- **Backend modules**: `server/devstats/enums.ts` (all volleyball enum constants), `server/devstats/metrics.ts` (aggregation helpers, attack efficiency, skill summaries), `server/devstats/report.ts` (development report generator with weakness detection + training suggestions).
- **Endpoints**: `GET /api/matches/:matchId/devstats/init` (roster + enums + events), `POST /api/matches/:matchId/devstats/events` (create event with detailed validation), `DELETE /api/matches/:matchId/devstats/events/:eventId` (undo), `POST /api/matches/:matchId/devstats/report/generate` (auto development report), `GET /api/coach/devstats/dashboard` (R/Y/G alerts + team summary + focus areas).
- **Coach Dashboard** (`/coach-dashboard`): Red/Yellow/Green player alerts table. Team performance summary (serve/receive/attack/block/dig/set). Per-player training focus recommendations. Rule-based thresholds: RED (receive minus% >= 20, serve error% >= 18, attack eff < 0, decision errors >= 6), YELLOW (moderate thresholds).

## New Features
- **Stats Comparison** (`/stats-comparison`): Side-by-side player stat comparison with visual bars. Select two players, compare kills/aces/blocks/digs/assists/points/errors/matches + awards count. Uses `GET /api/stats/compare?player1=ID&player2=ID`.
- **Real-Time Chat** (`/chat`): Room-based messaging (General + per-team rooms). REST-based with 3s auto-refresh via react-query. Role badges (ADMIN=gold, COACH=teal, PLAYER=muted). `chatMessages` table with `sentAt` timestamp. Endpoints: `GET /api/chat/rooms`, `GET /api/chat/messages/:roomId`, `POST /api/chat/messages`.
- **Match Simulation** (`/match-simulation`): Coaches build Starting 6 lineups from team roster. Shows per-player avg stats (kills/aces/blocks/digs/assists/points/efficiency). Team Strength Score = sum of efficiency. Save/load presets via localStorage. Compare mode for lineup testing. `GET /api/simulation/team-stats/:teamId`.
- **Report Templates** (`/report-templates`): 5 customizable report types: Season Summary, Player Report, Team Roster, Attendance Summary, Financial Summary. Each returns HTML for print-to-PDF. POST endpoints under `/api/reports/*`. Financial requires ADMIN/MANAGER/FINANCE; others require ADMIN/MANAGER/COACH/STATISTICIAN.

## GitHub Repository
- **Repo**: https://github.com/mosesmukisa1-a11y/afrocat-club-portal
- **Branch**: main
- **GitHub Integration**: Uses Replit GitHub connector
