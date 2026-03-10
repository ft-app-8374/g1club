# Group 1 Club — Product Specification

## Overview

Group 1 Club (group1club.com) is a private, invite-only horse racing tipping competition covering all Australian Group 1 races during the Spring Racing Carnival. Participants receive a virtual $100 per race and score based on official TAB dividends. The app replaces a WordPress site with manual Google Sheets processing.

## Brand

- **Name**: Merc's Group 1 Tipping (trading as Group 1 Club)
- **Tagline**: "Tipping winners since….. never"
- **Tone**: Irreverent, social, competitive
- **Operators**: Merc and Mills (admins)
- **Domain**: www.group1club.com

## Competition Model

### Season Structure
- **Period**: Late August → mid-November (Spring Carnival)
- **Rounds**: ~14 rounds, each containing 1-5 Group 1 races
- **Venues**: Sydney (Randwick, Rosehill) and Melbourne (Flemington, Caulfield, Moonee Valley)
- **Participants**: 50-100 invited members per season

### Betting Rules
- Each participant receives **$100 virtual per race** (non-compounding)
- Bets are **win and/or place only** — no exotics
- Maximum **4 bets per race** using the $100 allocation
- Win + place amounts must total exactly $100
- Participants start at **-$100 per race** (the stake is deducted before calculating returns)
- Free-form allocation (e.g. $60 win Horse A, $40 place Horse B) — but must be validated to equal $100

### Backup Tips
- Each selection requires a **backup horse** in case of scratching
- Backup inherits the **same bet type and amount** as the primary selection
- Multiple substitutes processed in listed order
- If no backup provided and horse scratched → no replacement (bet lost)

### Scratchings
- Runner list must update dynamically as scratchings are announced
- Scratched horses removed from dropdown selection
- If a user's primary pick is scratched before cutoff, they should update their tip
- If scratched after cutoff, backup auto-activates

### Tip Cutoff
- **1 hour before the first Group 1 race** on each race day
- All races on that day lock at the same time
- Before cutoff: users see only their own tips
- After cutoff: all users' tips become visible
- Missed tips: scored as -$100 per race

### Settlement
- Uses **official TAB dividends** (not Betfair BSP — this is a change from 2025 rules which used Betfair SP)
- Settlement should be **automated** via TAB Studio API as close to race finish as possible
- Standard racing rules apply for dead heats, protests, amended results
- Place positions follow standard rules (3 places for 8+ runners, etc.)

### Scoring
- Race P&L = -$100 + sum of returns from winning bets
- Carnival P&L = sum of all race P&Ls
- Leaderboard ranked by total P&L (highest profit)

## Prize Structure (2025 Reference)

| Prize | Amount |
|-------|--------|
| 1st Overall | $1,000 |
| 2nd Overall | $400 |
| 3rd Overall | $200 |
| Round Winners (14x) | $50 each |
| Captain Consistency | $125 |
| Cup Week Hero | $125 |

- **Entry fee**: $55 via PayPal
- Prize pool determined once final numbers confirmed
- Not-for-profit — all funds go back into competition

## Awards

### Captain Consistency
- 1 point for each round where your round P&L > $0 (profitable round)
- Highest tally at end of carnival wins
- Tiebreaker: TBD (total P&L?)

### Cup Week Hero
- Best performing tipster during Melbourne Cup Carnival week (4 days: Derby Day, Cup Day, Oaks Day, Stakes Day)
- Separate leaderboard

### Wooden Spoon
- Awarded to last-place finisher (hall of shame)
- Simmo holds the record with 4 wooden spoons

## User Roles

### Member (Tipster)
- View race calendar and fields
- Submit/edit tips before cutoff
- View own tips anytime
- View all tips after cutoff
- View live leaderboard
- View race results and personal P&L breakdown
- View historical honour roll
- Receive notifications

### Admin (Merc / Mills)
- All member capabilities
- Manage carnival season (create, configure rounds/races)
- Invite new members (generate invite codes)
- Mark members as "financial" (paid entry fee)
- Override/correct tips if needed
- Manual result entry (fallback if API fails)
- Manage prize pool configuration
- Publish news/announcements

## Historical Data

### Honour Roll (Past Winners)
- Simple list: year, winner name, total profit
- Currently behind WordPress login wall
- Needs migration to new system

### 2025 Final Leaderboard (Known)
| Pos | Name | Total |
|-----|------|-------|
| 1 | Law | $3,055.10 |
| 2 | TheCat | $1,437.60 |
| 3 | Chriso | $1,274.00 |
| 4 | Dogbet | $738.00 |
| 5 | Kilsby | $466.00 |

## Notifications

| Event | Channel | Priority |
|-------|---------|----------|
| Fields published for race day | Push + in-app | High |
| Tips close in 1 hour | Push + in-app countdown | High |
| Tip confirmed | In-app toast | Medium |
| Race result / settlement | Push + in-app | High |
| Leaderboard updated | In-app | Low |
| Haven't tipped yet (morning of) | Push | Medium |
| Season opens / registration | Email + push | High |

## Non-Functional Requirements

- **Mobile-first** — majority of users access via phone
- **Modern, sleek UI** — dark theme, racing-inspired design
- **Real-time feel** — leaderboard updates as results come in
- **Seasonal usage** — high traffic Aug-Nov, minimal off-season
- **50-100 concurrent users** — lightweight infrastructure sufficient
- **Browser-based** — no PWA/app store required for now
