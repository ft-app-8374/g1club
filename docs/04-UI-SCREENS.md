# Group 1 Club — UI Screens & User Flows

## Design Principles

- **Mobile-first**: All layouts designed for 375px+ width, scale up for desktop
- **Dark theme**: Deep navy (#0a0f1e) background, card surfaces (#141b2d)
- **Racing palette**: Gold (#d4a843) for accents/wins, emerald (#10b981) for profit, red (#ef4444) for loss, white (#f1f5f9) for text
- **Typography**: Bold headings, clean sans-serif (Inter or similar)
- **Cards**: Rounded corners, subtle borders, slight shadows
- **Motion**: Framer Motion for leaderboard reordering, tab transitions, number counting
- **Real-time feel**: Live countdown timers, animated leaderboard updates

## Screen Map

```
Login ──→ Register (with invite code)
  │
  ▼
Dashboard (Home)
  ├── Race Day Banner (countdown to cutoff / live results)
  ├── Quick Stats (your rank, total P&L, next race)
  ├── Recent Results Feed
  └── Navigation:
        ├── Races (calendar + tip submission)
        ├── Leaderboard
        ├── My Tips
        ├── Honour Roll
        ├── Profile
        └── Admin (admin only)
```

## Screen Details

---

### 1. Login

```
┌─────────────────────────────────┐
│                                 │
│        🏇 Group 1 Club         │
│    "Tipping winners since…      │
│           never"                │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Username                  │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Password            👁    │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │         LOG IN            │  │
│  └───────────────────────────┘  │
│                                 │
│  Have an invite code? Register  │
│  Forgot password?               │
└─────────────────────────────────┘
```

---

### 2. Register

```
┌─────────────────────────────────┐
│        Join the Club            │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Invite Code               │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Display Name (e.g. Law)   │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Email                     │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Password                  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │       CREATE ACCOUNT      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

### 3. Dashboard (Home)

```
┌─────────────────────────────────┐
│  Group 1 Club     [🔔] [👤]    │
├─────────────────────────────────┤
│                                 │
│  ┌─ RACE DAY BANNER ─────────┐ │
│  │ ⏱ Tips close in 2h 14m    │ │
│  │ Caulfield Cup Day          │ │
│  │ 3 races · Caulfield        │ │
│  │        [TIP NOW →]         │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ YOUR STATS ──────────────┐ │
│  │ Rank        P&L     Races │ │
│  │ 🥇 1st    +$2,839   33   │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ LATEST RESULTS ──────────┐ │
│  │ Melbourne Cup              │ │
│  │ 1st GRINGOTTS  $6.70      │ │
│  │ 2nd VAUBAN     $3.20 pl   │ │
│  │ Your P&L: +$302    ↑ 2nd  │ │
│  │                            │ │
│  │ Crown Oaks                 │ │
│  │ 1st STRICTLY BUSINESS      │ │
│  │ Your P&L: -$100           │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ NEWS ────────────────────┐ │
│  │ 📰 "Two-Timer Law clean   │ │
│  │    sweeps 🏆🧹"           │ │
│  │    Nov 20 · by Merc        │ │
│  └────────────────────────────┘ │
│                                 │
├──────────────────────────────── │
│ 🏠  📋  🏆  📜  👤            │
│Home Races Lead  Roll Profile   │
└─────────────────────────────────┘
```

**Banner states:**
- Pre-season: "2026 Spring Carnival starts [date]. Get ready!"
- Race day, pre-cutoff: Countdown timer + "TIP NOW" CTA
- Race day, post-cutoff: "Tips locked — races from [time]"
- Race day, live: "Racing now — [race name] jumped at [time]"
- Off-season: "See you next Spring! Final standings below"

---

### 4. Races (Calendar View)

```
┌─────────────────────────────────┐
│  ← Races         2026 Spring   │
├─────────────────────────────────┤
│                                 │
│  AUG 24 · Round 1              │
│  ┌────────────────────────────┐ │
│  │ Winx Stakes    Randwick    │ │
│  │ 1400m · 3:45pm             │ │
│  │ Status: ✅ Tipped          │ │
│  └────────────────────────────┘ │
│                                 │
│  SEP 7 · Round 2               │
│  ┌────────────────────────────┐ │
│  │ Memsie Stakes  Caulfield   │ │
│  │ 1400m · 4:00pm             │ │
│  │ Status: ⚠️ Not tipped      │ │
│  └────────────────────────────┘ │
│  ┌────────────────────────────┐ │
│  │ Golden Rose    Rosehill    │ │
│  │ 1400m · 4:35pm             │ │
│  │ Status: ⚠️ Not tipped      │ │
│  └────────────────────────────┘ │
│                                 │
│  OCT 19 · Round 7              │
│  ┌────────────────────────────┐ │
│  │ Caulfield Cup  Caulfield   │ │
│  │ 2400m · 3:15pm             │ │
│  │ Status: 🔒 Locked          │ │
│  │ Result: +$302              │ │
│  └────────────────────────────┘ │
│                                 │
│  ...                            │
└─────────────────────────────────┘
```

**Race card status indicators:**
- Fields not yet released: greyed out, "Fields TBA"
- Open for tipping: highlighted, "Tip Now"
- Tipped: checkmark with summary
- Not tipped (cutoff approaching): warning amber
- Locked (post-cutoff): lock icon
- Settled: result + your P&L shown

---

### 5. Tip Submission (per race)

```
┌─────────────────────────────────┐
│  ← Melbourne Cup                │
│  Flemington · 3200m · 3:00pm   │
│  ⏱ Cutoff in 1h 23m            │
├─────────────────────────────────┤
│                                 │
│  Budget: $100                   │
│  Remaining: $40                 │
│                                 │
│  ┌─ BET 1 ───────────────────┐ │
│  │ Horse  [▼ GRINGOTTS     ] │ │
│  │ Type   [WIN ▼]            │ │
│  │ Amount [$60        ]      │ │
│  │                            │ │
│  │ Backup [▼ VAUBAN        ] │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ BET 2 ───────────────────┐ │
│  │ Horse  [▼ VIA SISTINA   ] │ │
│  │ Type   [PLACE ▼]          │ │
│  │ Amount [$40        ]      │ │
│  │                            │ │
│  │ Backup [▼ WITHOUT A...  ] │ │
│  └────────────────────────────┘ │
│                                 │
│  [+ Add Another Bet]           │
│  (max 4 bets per race)         │
│                                 │
│  ┌───────────────────────────┐  │
│  │ $60 WIN Gringotts         │  │
│  │ $40 PLC Via Sistina       │  │
│  │ ─────────────────         │  │
│  │ Total: $100 ✅             │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │       SUBMIT TIPS         │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

**Validation rules (real-time):**
- Total must equal exactly $100 (submit disabled until valid)
- "Remaining: $X" counter updates as amounts change
- Horse dropdown excludes scratched runners (shown greyed with "SCR" if recently scratched)
- Backup dropdown excludes the primary horse
- Same horse can't be selected in multiple bet lines
- After submit: summary card replaces form, "Edit" button to modify

---

### 6. All Tips (post-cutoff, per race)

```
┌─────────────────────────────────┐
│  ← Melbourne Cup Tips           │
│  🔒 Locked · Race at 3:00pm    │
├─────────────────────────────────┤
│                                 │
│  ┌─ Law ─────────────────────┐ │
│  │ $60 WIN  Gringotts        │ │
│  │ $40 PLC  Via Sistina      │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ TheCat ──────────────────┐ │
│  │ $100 WIN  Buckaroo        │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ Chriso ──────────────────┐ │
│  │ $50 WIN  Gringotts        │ │
│  │ $50 PLC  Gringotts        │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Did not tip ──              │
│  Simmo · Benny Leal             │
│                                 │
└─────────────────────────────────┘
```

---

### 7. Leaderboard

```
┌─────────────────────────────────┐
│  Leaderboard      [Overall ▼]  │
├─────────────────────────────────┤
│                                 │
│  ┌────────────────────────────┐ │
│  │ 🥇 Law          +$3,055   │ │
│  │    W14  △ consistent       │ │
│  ├────────────────────────────┤ │
│  │ 🥈 TheCat       +$1,437   │ │
│  │    W14  ▽ was 1st R12     │ │
│  ├────────────────────────────┤ │
│  │ 🥉 Chriso       +$1,274   │ │
│  │    W14                     │ │
│  ├────────────────────────────┤ │
│  │  4  Dogbet        +$738   │ │
│  ├────────────────────────────┤ │
│  │  5  Kilsby        +$466   │ │
│  ├────────────────────────────┤ │
│  │  ...                      │ │
│  ├────────────────────────────┤ │
│  │  🥄 Simmo      -$2,400   │ │
│  │     Wooden Spoon x4 🏆    │ │
│  └────────────────────────────┘ │
│                                 │
│  Filter: [Overall] [Round X]   │
│          [Cup Week] [Consist.] │
│                                 │
└─────────────────────────────────┘
```

**Leaderboard features:**
- Animated position changes when results settle
- Profit in green, loss in red
- Trend arrows (up/down from previous round)
- Tap row to see user's full race-by-race breakdown
- Filter tabs: Overall, per-round, Cup Week Hero, Captain Consistency
- Highlight current user's row

---

### 8. Honour Roll

```
┌─────────────────────────────────┐
│  The Golden Ponies              │
├─────────────────────────────────┤
│                                 │
│  ┌─ 2025 ────────────────────┐ │
│  │ 🏆 Law         +$3,055   │ │
│  │ 🥈 TheCat      +$1,437   │ │
│  │ 🥉 Chriso      +$1,274   │ │
│  │ 🥄 Simmo       -$2,xxx   │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ 2024 ────────────────────┐ │
│  │ 🏆 Law         +$X,XXX   │ │
│  │ 🥈 ...                    │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ 2023 ────────────────────┐ │
│  │ 🏆 ...                    │ │
│  └────────────────────────────┘ │
│                                 │
│  Multi-time winners:            │
│  Law (2024, 2025)               │
│  Simmo: 4x Wooden Spoon 🥄     │
│                                 │
└─────────────────────────────────┘
```

---

### 9. Profile

```
┌─────────────────────────────────┐
│  ← Profile                     │
├─────────────────────────────────┤
│                                 │
│         [Avatar/Initials]       │
│            Law                  │
│     Member since 2023           │
│     ✅ Financial (2026)         │
│                                 │
│  ┌─ Career Stats ────────────┐ │
│  │ Carnivals: 3               │ │
│  │ Races tipped: 89           │ │
│  │ Win rate: 23%              │ │
│  │ Best finish: 🏆 1st (x2)  │ │
│  │ Career P&L: +$6,210       │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ Notifications ───────────┐ │
│  │ Push notifications  [ON]  │ │
│  │ Email fallback      [ON]  │ │
│  └────────────────────────────┘ │
│                                 │
│  [Change Password]              │
│  [Log Out]                      │
│                                 │
└─────────────────────────────────┘
```

---

### 10. Admin Panel

```
┌─────────────────────────────────┐
│  ← Admin                       │
├─────────────────────────────────┤
│                                 │
│  ┌─ Members (67) ────────────┐ │
│  │ Search...                  │ │
│  │ Law        ✅ Financial    │ │
│  │ TheCat     ✅ Financial    │ │
│  │ NewGuy     ⚠️ Unpaid      │ │
│  │ [Generate Invite Code]     │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ Carnival Setup ──────────┐ │
│  │ 2026 Spring     [Active]  │ │
│  │ 14 rounds · 38 races      │ │
│  │ [Edit] [Sync Fields]      │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ Manual Overrides ────────┐ │
│  │ Enter result for race...  │ │
│  │ [Select Race ▼]           │ │
│  │ Useful if TAB API delayed │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌─ Announcements ───────────┐ │
│  │ Post a news update...     │ │
│  │ [Title] [Body] [Send]     │ │
│  └────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

## Navigation

### Bottom Tab Bar (Mobile)
```
🏠 Home  |  📋 Races  |  🏆 Board  |  📜 Roll  |  👤 Profile
```

### Desktop
- Side navigation or top nav bar with same items
- Admin link visible only to admin users
- Notification bell in header

## Responsive Breakpoints

| Width | Layout |
|-------|--------|
| < 640px | Mobile: single column, bottom tab bar |
| 640-1024px | Tablet: wider cards, same layout |
| > 1024px | Desktop: side nav, 2-column dashboard |
