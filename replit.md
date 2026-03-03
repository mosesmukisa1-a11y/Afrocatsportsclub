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

## GitHub Repository
- **Repo**: https://github.com/mosesmukisa1-a11y/afrocat-club-portal
- **Branch**: main
- **GitHub Integration**: Uses Replit GitHub connector
