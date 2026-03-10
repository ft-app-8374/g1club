# Group 1 Club — Technical Architecture

## Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14 (App Router) + React | SSR, fast transitions, single deployment |
| Styling | Tailwind CSS + Framer Motion | Modern design system, subtle animations |
| Backend | Next.js API Routes | Co-located with frontend, simple deployment |
| Database | PostgreSQL (RDS db.t4g.micro) | Relational data, concurrent writes at cutoff |
| Auth | NextAuth.js (credentials provider) | Invite-only, session-based |
| Hosting | AWS App Runner | Container-based, auto-deploy from git, auto-SSL |
| CDN | AWS CloudFront | Edge-cached static assets for fast mobile loads |
| Cron | AWS EventBridge | Scheduled jobs: poll TAB API for fields/results |
| Email | AWS SES | Transactional emails (confirmations, fallback notifications) |
| Push | Web Push API (VAPID) | Browser push notifications |
| Storage | AWS S3 | Static assets, database backups |
| DNS | AWS Route 53 | Domain management for group1club.com |
| Data Source | Betfair Exchange API (free delayed key) | Race fields, scratchings, BSP dividends |

## System Diagram

```
                          ┌─────────────────┐
                          │   CloudFront     │
                          │   (CDN/SSL)      │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │   App Runner      │
                          │   (Next.js)       │
                          │                   │
                          │  ┌─────────────┐  │
                          │  │ Pages (SSR)  │  │
                          │  │ API Routes   │  │
                          │  │ Cron Handler │  │
                          │  └──────┬──────┘  │
                          └─────────┼─────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
           ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
           │   RDS        │ │  TAB Studio │ │    SES      │
           │  PostgreSQL  │ │    API      │ │   (Email)   │
           │              │ │             │ │             │
           └──────────────┘ └─────────────┘ └─────────────┘
                                                    │
                                            ┌───────▼──────┐
                                            │  EventBridge  │
                                            │  (Cron Jobs)  │
                                            └──────────────┘
```

## Data Flow

### 1. Season Setup (Admin, once per year)
```
Admin creates carnival
  → Admin adds rounds + race dates (or imports from known calendar)
  → EventBridge schedules field-polling jobs for each race day
```

### 2. Field Loading (Automated, days before race)
```
EventBridge triggers cron (daily at 6am AEST during carnival)
  → API route calls Betfair Exchange API for upcoming race fields
  → Runners inserted/updated in DB
  → If new fields found → push notification to all members
```

### 3. Scratching Updates (Automated, race day)
```
EventBridge triggers cron (every 15 min on race day)
  → API route checks Betfair Exchange API for scratchings
  → Scratched runners flagged in DB
  → Affected users' tips auto-switch to backup if after cutoff
  → Push notification to affected users if before cutoff
```

### 4. Tip Submission (User action, before cutoff)
```
User opens race day → sees runner dropdowns (scratched horses removed)
  → Selects horse, bet type (win/place), amount
  → Client-side validation: total = $100, max 4 bets
  → Selects backup horse (inherits same allocation)
  → Submit → server validates → stores in DB
  → In-app toast confirmation
  → Can edit until cutoff
```

### 5. Cutoff (Automated, 1hr before first G1)
```
EventBridge triggers cutoff job
  → Race day status set to "locked"
  → All users' tips become visible to all
  → Users without tips scored -$100 per race
  → Push notification: "Tips are locked — good luck!"
```

### 6. Race Settlement (Automated, after each race)
```
EventBridge triggers polling (every 60s after scheduled jump time)
  → API route checks Betfair Exchange API for official dividends
  → When dividends available:
    → Calculate P&L for each user's tip on this race
    → Store result + individual P&L in DB
    → Update leaderboard
    → Push notification: "Race X settled — check the leaderboard!"
  → Stop polling after dividends received (or after 30 min timeout)
```

### 7. Leaderboard (Real-time via SSE)
```
Client connects to /api/leaderboard/stream (Server-Sent Events)
  → On settlement, server broadcasts leaderboard update
  → Client animates position changes
  → No full page reload needed
```

## API Routes

### Auth
- `POST /api/auth/login` — credentials login
- `POST /api/auth/logout` — end session
- `POST /api/auth/register` — register with invite code

### Races
- `GET /api/races` — list all races for current carnival
- `GET /api/races/[id]` — race detail with runners
- `GET /api/races/[id]/results` — race results + dividends

### Tips
- `GET /api/tips/mine` — current user's tips
- `GET /api/tips/race/[id]` — all tips for a race (post-cutoff only)
- `POST /api/tips` — submit/update tip
- `DELETE /api/tips/[id]` — remove tip (pre-cutoff only)

### Leaderboard
- `GET /api/leaderboard` — current standings
- `GET /api/leaderboard/stream` — SSE stream for live updates
- `GET /api/leaderboard/round/[id]` — round-specific standings
- `GET /api/leaderboard/awards` — special awards standings

### Admin
- `POST /api/admin/carnival` — create/update carnival
- `POST /api/admin/invite` — generate invite code
- `PATCH /api/admin/users/[id]` — update user (mark financial, etc.)
- `POST /api/admin/races/[id]/settle` — manual settlement fallback
- `POST /api/admin/races/[id]/runners` — manual runner entry fallback

### Cron (called by EventBridge)
- `POST /api/cron/fetch-fields` — pull fields from TAB API
- `POST /api/cron/check-scratchings` — pull scratchings
- `POST /api/cron/settle-race` — check for dividends + settle
- `POST /api/cron/cutoff` — lock tips for race day

## Security

- All cron endpoints authenticated via shared secret (EventBridge → API)
- User sessions via HTTP-only secure cookies (NextAuth.js)
- Invite codes are single-use, expire after 7 days
- Rate limiting on auth endpoints
- CSRF protection via NextAuth.js
- No real money — but user data and tips are private until cutoff

## Deployment

```
Developer pushes to GitHub main branch
  → App Runner detects change
  → Builds container (Dockerfile or buildpack)
  → Zero-downtime deployment (blue/green)
  → CloudFront cache invalidated for HTML (static assets versioned)
```

## Environments

| Environment | Purpose |
|-------------|---------|
| `local` | Development (SQLite for simplicity) |
| `staging` | Pre-production testing |
| `production` | Live at group1club.com |

## Monitoring

- App Runner built-in metrics (CPU, memory, request count)
- CloudWatch alarms for: API errors, cron failures, settlement delays
- Simple health check endpoint: `GET /api/health`
