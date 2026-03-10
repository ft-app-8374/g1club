# Group 1 Club — Migration & Implementation Plan

## Phase Overview

| Phase | What | When | Duration |
|-------|------|------|----------|
| 0 | TAB API access + data gathering | Now | 1-2 weeks |
| 1 | Backend: DB, auth, core API | After Phase 0 | 2-3 weeks |
| 2 | Frontend: UI screens, tipping flow | Parallel with Phase 1 | 2-3 weeks |
| 3 | Integration: TAB API automation | After Phase 1 | 1-2 weeks |
| 4 | Polish: notifications, animations, testing | After Phase 2+3 | 1-2 weeks |
| 5 | Migration: data, DNS, go-live | Before carnival | 1 week |
| **Total** | | | **~8-10 weeks** |
| **Target**: Live before August 2026 carnival start | | | |

## Phase 0: Prerequisites

### Actions Required (User)
- [ ] Create TAB betting account (if not existing)
- [ ] Apply for TAB Studio API personal access
- [ ] Provide honour roll data (all past winners + totals)
- [ ] Confirm 2026 prize structure and entry fee
- [ ] Confirm Captain Consistency scoring rules
- [ ] Confirm any rule changes from 2025 → 2026
- [ ] Decision: keep Betfair SP as fallback or TAB dividends only?

### Actions Required (Dev)
- [ ] Set up AWS infrastructure (App Runner, RDS, Route 53)
- [ ] Set up GitHub repo
- [ ] Set up Next.js project scaffold
- [ ] Test TAB API access once approved

## Phase 1: Backend

### 1.1 Database
- [ ] PostgreSQL schema (all tables from data model doc)
- [ ] Prisma ORM setup + migrations
- [ ] Seed script for: 2026 carnival, rounds, known Group 1 races

### 1.2 Auth
- [ ] NextAuth.js credentials provider
- [ ] Invite code registration flow
- [ ] Session management (JWT or database sessions)
- [ ] Role-based access (member vs admin)
- [ ] Password reset via SES email

### 1.3 Core API
- [ ] CRUD: tips (submit, edit, delete — pre-cutoff only)
- [ ] Tip validation (total = $100, max 4 lines, valid runners)
- [ ] Backup tip logic (auto-activate on scratching)
- [ ] Settlement engine (calculate P&L from dividends)
- [ ] Leaderboard aggregation queries
- [ ] Round-level + carnival-level standings
- [ ] Award calculations (Captain Consistency, Cup Week Hero)

### 1.4 Admin API
- [ ] Invite code generation
- [ ] User management (mark financial)
- [ ] Manual result entry (fallback)
- [ ] Carnival/round/race CRUD

## Phase 2: Frontend

### 2.1 Layout & Navigation
- [ ] Mobile-first shell (bottom tab bar, header)
- [ ] Dark theme + racing colour palette
- [ ] Responsive breakpoints

### 2.2 Screens
- [ ] Login + Register
- [ ] Dashboard (home)
- [ ] Races (calendar view)
- [ ] Tip submission form (with real-time validation)
- [ ] All tips view (post-cutoff)
- [ ] Leaderboard (with filters)
- [ ] Honour Roll
- [ ] Profile
- [ ] Admin panel
- [ ] Race result detail

### 2.3 Components
- [ ] Countdown timer (to cutoff)
- [ ] Budget calculator ($100 allocation)
- [ ] Runner dropdown (with scratching state)
- [ ] Leaderboard row (animated position changes)
- [ ] Notification bell + in-app notification list
- [ ] Toast notifications

## Phase 3: TAB API Integration

### 3.1 Field Loading
- [ ] TAB API client (auth, rate limiting, error handling)
- [ ] Race matching logic (our DB ↔ TAB meetings)
- [ ] Runner sync (insert new, flag scratchings)
- [ ] EventBridge cron: daily field check

### 3.2 Race Day Automation
- [ ] Scratching poller (every 15/5 min)
- [ ] Cutoff trigger (lock tips, reveal all)
- [ ] Result poller (every 60s post-jump)
- [ ] Settlement trigger (auto-calculate on dividend availability)

### 3.3 Fallback
- [ ] Manual result entry UI (admin)
- [ ] Manual field entry UI (admin)

## Phase 4: Polish

### 4.1 Notifications
- [ ] Web Push setup (VAPID keys, service worker)
- [ ] Push notification triggers (fields up, cutoff, results)
- [ ] In-app notification centre
- [ ] Email fallback via SES

### 4.2 Animations
- [ ] Leaderboard position transitions (Framer Motion)
- [ ] Number counting animation (P&L updates)
- [ ] Page transitions
- [ ] Skeleton loading states

### 4.3 Testing
- [ ] Settlement calculation unit tests (edge cases: dead heats, scratchings, no tip)
- [ ] Tip validation tests
- [ ] Cutoff logic tests
- [ ] End-to-end: submit tip → settle race → check leaderboard
- [ ] Load test: 100 concurrent tip submissions

## Phase 5: Migration

### 5.1 Data Migration
- [ ] Import honour roll data
- [ ] Import 2025 final leaderboard (if full data available)
- [ ] Create admin accounts (Merc, Mills)
- [ ] Generate invite codes for existing members

### 5.2 DNS Cutover
- [ ] Point group1club.com to CloudFront distribution
- [ ] Verify SSL
- [ ] Test from mobile devices
- [ ] Old WordPress site → archive or delete Lightsail instance

### 5.3 User Communication
- [ ] Email existing members: "New Group 1 Club is live"
- [ ] Include registration link with invite codes
- [ ] Brief guide: how to enable push notifications

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| TAB API access denied | Apply early. Fallback: Punting Form ($59/mo) for fields, manual dividend entry |
| TAB API unreliable on race day | Manual override in admin panel. Result entry takes 2 min |
| Concurrent tip submissions at cutoff | PostgreSQL handles this well. Unique constraint prevents duplicates |
| Users don't enable push notifications | Email fallback always sent for critical notifications |
| Race abandoned/cancelled | Admin marks race as abandoned. All users scored $0 (not -$100) |
| Time zone issues | All times stored as AEST/AEDT. Server runs in ap-southeast-2 |

## Post-Launch Enhancements (Future)

- Live odds display during tipping (if TAB API provides)
- Chat/banter feed between members
- Automated blog post generation (round summaries)
- Social sharing (share your tips/results)
- Mobile PWA (add to home screen)
- Historical stats dashboard (career win rate, best horses, etc.)
- Tipping streaks and achievements
