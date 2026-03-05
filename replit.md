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
Users, Teams, Players (with full biodata + heightCm, weightKg, lastWeightUpdatedAt, employmentClass, joinedAt), Matches, PlayerMatchStats, SmartFocus, AttendanceSessions, AttendanceRecords, DisciplineCases, FinanceTxns, Injuries, Awards, ScoutingReports, CoachAssignments, CoachPerformanceSnapshots, PlayerContracts, ContractIssuedItems, ContractTransportBenefits, NvfTransferFeeSchedules, PlayerTransferCases, TeamOfficials, MatchDocuments, MatchSquads, MatchSquadEntries, PlayerReports, PlayerDocuments, ShopItems, MediaPosts, MediaTags, MediaTagRequests, MatchEvents, PlayerUpdateRequests, TrainingSessions, PlayerExcuseRequests, PlayerPayments, PlayerExpenses, FeeConfig, PlayerInterviews

## RBAC Roles
- **Super Admin**: mosesmukisa1@gmail.com — only user who can assign roles to others. Flagged via `isSuperAdmin` in DB.
- **Multi-Role Support**: Users can have multiple roles (stored in `roles` text[] column). The `role` column holds the primary role. JWT includes `roles[]`. Sidebar, `requireRole` middleware, and route guards check the full `roles` array.
- **Role Switcher**: Users with multiple roles see a "Switch Role" button in the sidebar. Switching changes `activeRole` (persisted in `localStorage["afrocat_active_role"]`), updates `user.role` in auth context, filters nav items to the active role's scope, and redirects to Dashboard. Role persists across page refreshes. Fallback priority: saved role > COACH > PLAYER > first role. Super admins always see all nav items regardless of active role. Mobile header also shows active role badge.
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
- **Enter Stats (Touch Stats)**: The ONLY stats entry method (`/stats`). Event-based touch entry: Tap Player → Action → Outcome detail. Live scoreboard with Points + Sets + Duration timer. Completed/locked matches filtered from dropdown. Team switch button to record away team stats. Score correction with -1 Home / -1 Away buttons. On sync: records match duration, sets result (W/L/D), sets final score. Match Report with player photos + stats + set breakdown viewable after sync. Fullscreen mode with Layout bypass. Roles: ADMIN, MANAGER, COACH, STATISTICIAN. Data feeds: Coach Dashboard, Player Dashboard, Admin Dashboard, Stats Comparison, Reports, Dev Stats — all read from the same `playerMatchStats` table populated by sync.
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
- **O2BIS Unified PDF Generator**: `server/o2bis.ts` — single shared `generateO2BISPdf(storage, options)` function used by both Document Centre and Match Section. Official FIFA-style format with Afrocat logo, teal table headers, proper bordered info rows (Association/Club, Date, Competition on left; Opponent, Venue, Head Coach on right). Player table columns: #, Jersey No, Full Name, DOB, Age, Country, M/F, Position, Signature. Team Officials table with Role, Full Name, Licence No, Signature columns — includes staff assignments (Head Coach, Asst Coach, Medic, Team Manager) merged with team officials. Signature section: Team Captain, Head Coach, Match Commissioner with Sign/Date lines. All null fields safely coalesced. Libero marked with `(L)`, Captain with `(C)`.
- **O2BIS PDF Download**: `GET /api/docs/o2bis/:matchId.pdf?skipMissing=true/false&teamId=...` — pdf-lib generated PDF. Missing fields shown as "________________" placeholders when skipMissing=true, blank when false. TeamId validated against match. Libero rule enforced before generation.
- **Squad Selection (Max 14)**: `matchSquadEntries` includes `isLibero`, `isCaptain`, `matchPosition` fields. Max 14 players per squad. If 14 selected, at least 2 must be liberos. Only 1 captain allowed. Coach can override position per match via `matchPosition`. Required O2BIS fields (name, DOB, nationality, jersey, position) validated server-side before save. Frontend shows missing field warnings and blocks save until resolved. Frontend shows modal prompt for libero rule with "Go Back" / "Auto-Select" options. `POST /api/matches/:matchId/squad/auto-select-liberos` auto-picks players with LIBERO position or lowest jersey numbers.
- **O2BIS PDF**: Captain name rendered in **bold** with `(C)` suffix from `isCaptain` field on squad entry (not user roles). Uses `matchPosition` from squad entry if set, otherwise player's registered position. 15mm margins for safe printing. Name auto-sizes if too long. `GET /api/docs/o2bis/:matchId/preview.pdf` for inline preview (no libero validation, skipMissing=true).
- **O2BIS Skip Modal**: Frontend shows missing info list with "Go Back & Fill" / "Skip & Generate" buttons. PDF downloaded via fetch+blob for JWT auth compatibility.
- **Player Sorting**: All player lists sorted alphabetically by lastName, firstName, jerseyNo across all endpoints.
- **Staff-Eligible Users Endpoint**: `GET /api/staff-eligible-users` for ADMIN/MANAGER/COACH to populate staff assignment dropdowns.
- **Matches.tsx UI**: Edit button (ADMIN), Staff Assignment button, O2BIS generation button on upcoming match cards.
- **Touch Stats Sync**: `POST /api/matches/:matchId/stats-touch/sync` — aggregates all touch events into `playerMatchStats` table. Calculates pointsTotal, generates Smart Focus recommendations, marks match as statsEntered.

## Touch Stats Scoreboard & FIVB Scoring
- **FIVB Auto Set-End**: Sets end automatically when score reaches target (25pts for normal sets, 15pts for deciding set) AND lead >= 2. Deciding set = set 3 for Best-of-3, set 5 for Best-of-5. Match auto-finalizes when a team reaches needed wins (2 for Bo3, 3 for Bo5).
- **Match Format**: `PATCH /api/matches/:matchId/format` sets bestOf (3|5) before scoring starts. UI shows format selector pre-scoring.
- **Big Sticky Point Pad**: Fixed bottom bar with "+1 AFROCAT" (teal), "+1 OPP" (gold), "UNDO" buttons. Min 70px height. Replaces old small +1 Home/Away/End Set/Switch Side buttons.
- **Match Finalize**: `POST /api/matches/:matchId/finalize` or auto-triggered on match completion. Locks match, aggregates stats, computes Player of Match, creates notifications for all players (stat summary + improvement areas) and coaches (report ready).
- **Player of Match**: Auto-computed weighted index (Kill+3, Ace+3, Stuff+3, Perfect+2, Positive+1, Assist+1, Dig+2, minus errors). Tiebreak: fewer total errors → higher receive quality → most scoring plays. Stored in `matches.playerOfMatchPlayerId`. Shown with gold star badge in UI.
- **Schema Fields**: `bestOf` (integer), `playerOfMatchPlayerId` (varchar) added to matches table.
- **Live Scoreboard**: Points + Sets + Current Set + Best-of indicator + Match Complete badge. Points hidden when match complete.
- **Auto Notifications**: Player stats notification with kills/aces/blocks/digs/errors + improvement focus. Coach/admin notification when match report is ready. All-user notification for Player of Match.
- **Expanded Outcome Panels**: Skill-specific outcome buttons with point attribution arrows.
- **Setter Combinations**: After SET success, combo picker: ONE / ZERO / FAST_BALL / SKIP.
- **Legacy Guard**: Manual end-set endpoint blocked for FIVB-format matches (bestOf set).

## Advanced Development Stats Platform
- **Dev Stats Page** (`/dev-stats`): Full development-focused stat tracking with detailed fields per skill type (Serve types, Receive ratings, Set quality, Attack outcomes, Block types, Dig types). Error classification (Technical/Decision/Pressure/Fatigue). Pressure + Fatigue flags. Zones, tactical intentions, notes.
- **Schema**: `matchEvents` table extended with: `rotation`, `subType`, `zone`, `tempo`, `outcomeDetail`, `errorCategory`, `errorType`, `pressureFlag`, `fatigueFlag`, `tacticalIntention`, `notes`.
- **Backend modules**: `server/devstats/enums.ts` (all volleyball enum constants), `server/devstats/metrics.ts` (aggregation helpers, attack efficiency, skill summaries), `server/devstats/report.ts` (development report generator with weakness detection + training suggestions).
- **Endpoints**: `GET /api/matches/:matchId/devstats/init` (roster + enums + events), `POST /api/matches/:matchId/devstats/events` (create event with detailed validation), `DELETE /api/matches/:matchId/devstats/events/:eventId` (undo), `POST /api/matches/:matchId/devstats/report/generate` (auto development report), `GET /api/coach/devstats/dashboard` (R/Y/G alerts + team summary + focus areas).
- **Coach Dashboard** (`/coach-dashboard`): Red/Yellow/Green player alerts table. Team performance summary (serve/receive/attack/block/dig/set). Per-player training focus recommendations. Rule-based thresholds: RED (receive minus% >= 20, serve error% >= 18, attack eff < 0, decision errors >= 6), YELLOW (moderate thresholds).

## New Features
- **Stats Comparison** (`/stats-comparison`): Side-by-side player stat comparison with visual bars. Select two players, compare kills/aces/blocks/digs/assists/points/errors/matches + awards count. Uses `GET /api/stats/compare?player1=ID&player2=ID`.
- **Real-Time Chat** (`/chat`): Room-based messaging (General + per-team rooms) + Direct Messages between users. REST-based with 3s auto-refresh. Role badges. DM threads sidebar with user picker dialog. `POST /api/chat/dm` creates DM room with initial message. `GET /api/chat/dm-threads` lists user's DM conversations. `GET /api/chat/users` for user picker.
- **Match Simulation** (`/match-simulation`): Coaches build Starting 6 lineups from team roster. Shows per-player avg stats. Team Strength Score. Save/load presets via localStorage. Compare mode.
- **Report Templates** (`/report-templates`): 5 customizable report types. Each returns HTML for print-to-PDF.
- **Notice Board** (`/notices`): Club announcements system. Admin/Manager create notices with title, body, audience (ALL or specific team). `noticeBoardPosts` table. Dashboard widget shows latest 3 notices.
- **Email Compose** (`/email-compose`): Admin sends emails via Gmail (afrocatvolleyballclub@gmail.com). Auto CC to afrocatladiesvc@gmail.com. Uses nodemailer with GMAIL_USER + GMAIL_APP_PASSWORD secrets.
- **Web Push Notifications**: Service worker at `client/public/sw.js`. Push subscription registered on login. `pushSubscriptions` table stores user subscriptions. VAPID key served via `GET /api/push/vapid-key`. Notifications displayed with club favicon.
- **Contract Bypass for Squad Selection**: Players without active contracts can be selected for match squads. `contractWarning: true` badge shown in UI instead of blocking selection.
- **Coach's Corner Blog** (`/coach-blog`): Blog platform for coaches to share insights, strategies, and training tips with the team. Features: category filtering (General, Tactics, Training, Motivation, Analysis, Fitness, Mental Game), tags, pinned posts, comments with role badges, edit/delete own posts (admins can edit all). Tables: `coachBlogPosts`, `coachBlogComments`. All roles can read; ADMIN/MANAGER/COACH can write.
- **Media Gallery** (`/media-gallery`): File-upload-based media gallery for all users. `POST /api/media/upload` (multipart/form-data, ADMIN/MANAGER only) saves files to `public/uploads/media/`. `GET /api/media` returns all approved media. Static serving via `/uploads/...`. Frontend: grid gallery with image/video preview, lightbox viewer, upload dialog. All roles can view; only ADMIN/MANAGER can upload.
- **Player Interviews** (`/interviews`): Q&A interviews with players (text or video format). `playerInterviews` table with questions/answers arrays, tags, featured flag. CRUD endpoints: `GET/POST /api/interviews`, `GET/PATCH/DELETE /api/interviews/:id`. ADMIN/MANAGER/COACH can create/edit/delete; all roles can view. Features: featured interviews hero section, search by title/player/question, tag filter (Debut, Pre-Match, Post-Match, Training, etc.), expandable Q&A cards, video embed support (YouTube/Vimeo iframe), player photo + jersey + position display. PATCH validates allowed fields only (strips publishedBy/publishedAt). VIDEO format requires videoUrl.
- **Coach Dashboard Multi-Team** (`/coach-dashboard`): Team selector from coach-assigned teams (via `/api/coach/my-teams`). Tabs: Overview (player/match/session counts + attendance %), Stats (team summary per match), Player Weakness (R/Y/G badges with expandable details), Training (schedule sessions with gender-day auto-default), Attendance (trends + top/low attendees), Finance (team player balances). Performance trends from last 5 matches.
- **Player Excuse/Late System**: Players submit excuse/late requests via Attendance page. Form: select session or date, type (EXCUSE/LATE), reason text. Coach/Admin/Manager approve/reject with optional note. Tables: `playerExcuseRequests`. Routes: `POST /api/attendance/excuse-request`, `GET /api/attendance/excuse-requests` (admin), `GET /api/attendance/excuse-requests/mine` (player), `POST /api/attendance/excuse-requests/:id/approve|reject`.
- **Finance Module** (`/finance`): Full financial management with tabs — Summary (received/expenses/net/pending), Payments (record with approval workflow), Expenses (log with approval), Player Finance (per-player outstanding/paid/value breakdown), Fee Config (admin sets membership/development/resource/league fees), General Ledger (legacy transactions). Tables: `playerPayments`, `playerExpenses`, `feeConfig`. Fee defaults: Non-Working N$400, Working N$800, Development N$2500, Resource N$1500, League N$0. Player Value = sum of approved expenses + payments where paidBy ≠ PLAYER. Approval roles: ADMIN/FINANCE. Management roles: ADMIN/FINANCE/MANAGER.
- **Training Schedule Fix**: WOMEN → [1, 3] (Mon, Wed), MEN → [2, 4] (Tue, Thu), ALL → [5] (Fri). `trainingSessions` table for custom session scheduling with venue, notes, targetGender.
- **Officials Management** (`/officials`): ADMIN/MANAGER assign officials to teams with roles (Referee, Assistant Referee, Scorer, Line Judge, Match Commissioner). `officialTeamAssignments` table. Member search picker for selecting officials. `GET /api/officials` returns users with nested assignments; `POST /api/officials/assign` creates assignment; `DELETE /api/officials/assign/:id` removes. Frontend flattens assignments into grouped display.
- **Tactic Board** (Coach's Corner tab): Interactive SVG volleyball court with draggable player positions and arrow annotation drawing. Coaches create/save/load/delete boards per team. `coachTacticBoards` table with JSON board data. `GET/POST/PATCH/DELETE /api/tactic-boards`. Default 6 positions (S, MB, OH, L, OP, OH2) on a volleyball court layout.
- **Media Multi-Upload**: Media gallery supports selecting and uploading up to 10 files at once. Uses `multer.array("files", 10)`. Upload progress indicator per file. Download button on each media card and in lightbox viewer. Fullscreen slideshow mode for image media.
- **Email Member Picker**: EmailCompose.tsx includes member search/picker with name, role, and team filters. "Add all" button to bulk-add visible members. Selected emails shown as removable chips.
- **Chat DM Notifications**: When a DM message is sent, a `CHAT_MESSAGE` notification is created for the recipient.
- **Member Search API**: `GET /api/members/search?q=&role=&teamId=` returns users with id, fullName, email, role, teamName, teamId. Supports name/email/team name fuzzy search plus role and team filters.

- **ErrorBoundary**: React class component wrapping `<Router />` in App.tsx. Catches unhandled React errors, displays a dark-themed "Something went wrong" fallback with Reload button, and logs errors to `POST /api/log/client-error` (message, stack, componentStack, route). Server endpoint logs to console.error, no auth required.
- **Mobile Bottom Navigation**: Fixed bottom tab bar (`client/src/components/MobileNav.tsx`) visible only on mobile (md:hidden). Tabs: Home, Matches, Stats, Chat, Media, More (opens sidebar). Role-aware — filters tabs based on active role. Active tab highlighted teal. 56px touch targets. Content area has `pb-20 md:pb-0` to avoid overlap.
- **System Check Admin Page** (`/admin/system-check`): Admin-only page that runs sequential health checks against 8 API endpoints (teams, players, matches, media, finance, notifications, chat, notices) and shows PASS/FAIL status. Also calls `GET /api/admin/env-check` to display which environment variables (GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_AUTO_CC, DATABASE_URL) are configured without revealing values.
- **Null-Safety Hardening**: All `.map()`, `.filter()`, `.find()`, `.reduce()`, `.some()`, `.length` calls across Dashboard, CoachDashboard, Finance, Attendance, Players, and Matches pages are guarded with `(arr || [])` patterns. Optional chaining and `?? 0` / `?? "—"` fallbacks added for nested property access.

- **Alphabetical Player Sorting**: All player listings (Players, Attendance, SquadSelector, Finance, EmailCompose, Officials) sort by `lastName firstName` alphabetically.
- **Best of 5 Default**: New matches default to Best of 5 format (server + client). FIVB rules apply (sets to 25, deciding set to 15, win by 2).
- **Ace Celebration Effects**: When ACE is recorded in TouchStats, triggers device vibration, gold flash animation on scoreboard, fireworks toast, and server-side MATCH_STAT notification to the player.
- **Unpaid Fee Reminders**: Player dashboard shows outstanding fees warning card with breakdown by fee type. Weekly Monday cron job creates FINANCE_REMINDER notifications for players with balances.
- **Coach Dashboard Recharts**: Performance trends use Recharts LineChart (serve error/receive perfect/attack efficiency). Attendance trends use Recharts BarChart with dark theme styling.
- **Interview Video Recording**: `VideoRecorder` component (`client/src/components/VideoRecorder.tsx`) uses MediaRecorder API for in-browser video capture from device camera. Integrated into PlayerInterviews — users can record video OR paste embed URL for VIDEO format interviews.
- **Dashboard Media Slideshow**: Carousel of recent approved media on Dashboard using Embla carousel with auto-rotation (4s). Shows images and videos responsively.
- **Player Search Enhancements**: EmailCompose and Officials pages have gender filter dropdowns and alphabetical sorting. Scrollable result containers.

## GitHub Repository
- **Repo**: https://github.com/mosesmukisa1-a11y/afrocat-club-portal
- **Branch**: main
- **GitHub Integration**: Uses Replit GitHub connector
