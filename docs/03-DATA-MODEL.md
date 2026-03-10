# Group 1 Club — Data Model

## Entity Relationship Diagram

```
┌──────────┐     ┌───────────┐     ┌──────────┐
│  User    │────<│ Tip       │>────│  Race    │
└──────────┘     └───────────┘     └──────────┘
     │                │                  │
     │           ┌────▼─────┐      ┌─────▼─────┐
     │           │TipLine   │>─────│  Runner   │
     │           └──────────┘      └───────────┘
     │                                   │
     │                             ┌─────▼─────┐
     │                             │  Result   │
     │                             └───────────┘
     │
     │           ┌───────────┐     ┌───────────┐
     └──────────<│  Ledger   │>────│   Race    │
                 └───────────┘     └───────────┘
                                        │
                                   ┌────▼──────┐
                                   │  Round    │
                                   └───────────┘
                                        │
                                   ┌────▼──────┐
                                   │ Carnival  │
                                   └───────────┘
```

## Tables

### users
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| username | varchar(50) | Unique, display name (e.g. "Law", "TheCat") |
| email | varchar(255) | Unique |
| password_hash | varchar(255) | bcrypt |
| role | enum('member','admin') | Default: member |
| is_financial | boolean | Admin marks as paid |
| invite_code_used | varchar(20) | Which code they registered with |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### invite_codes
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| code | varchar(20) | Unique, random string |
| created_by | uuid | FK → users.id (admin who created it) |
| used_by | uuid | FK → users.id (nullable, set on use) |
| expires_at | timestamptz | 7 days from creation |
| created_at | timestamptz | |

### carnivals
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | varchar(100) | e.g. "2026 Spring Carnival" |
| year | int | e.g. 2026 |
| start_date | date | First race day |
| end_date | date | Last race day |
| entry_fee | decimal(8,2) | e.g. 55.00 |
| status | enum('upcoming','active','completed') | |
| prize_config | jsonb | Prize pool structure |
| created_at | timestamptz | |

### rounds
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| carnival_id | uuid | FK → carnivals.id |
| number | int | Round number (1-14) |
| name | varchar(100) | e.g. "Round 1 — Winx Stakes Day" |
| race_date | date | The date races occur |
| cutoff_at | timestamptz | 1hr before first G1 that day |
| status | enum('upcoming','open','locked','settled') | |
| created_at | timestamptz | |

### races
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| round_id | uuid | FK → rounds.id |
| tab_race_id | varchar(50) | External ID from TAB API |
| name | varchar(200) | e.g. "Melbourne Cup" |
| venue | varchar(100) | e.g. "Flemington" |
| distance | int | Metres (e.g. 3200) |
| race_time | timestamptz | Scheduled jump time |
| race_number | int | Race number on the card |
| status | enum('upcoming','open','closed','final','abandoned') | |
| num_place_positions | int | 2 or 3 (based on field size) |
| created_at | timestamptz | |
| settled_at | timestamptz | When dividends were processed |

### runners
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| race_id | uuid | FK → races.id |
| tab_runner_id | varchar(50) | External ID from TAB API |
| name | varchar(200) | Horse name |
| barrier | int | Barrier draw |
| jockey | varchar(200) | |
| trainer | varchar(200) | |
| weight | decimal(4,1) | Carried weight (kg) |
| is_scratched | boolean | Default: false |
| scratched_at | timestamptz | When scratching was detected |
| created_at | timestamptz | |

### results
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| race_id | uuid | FK → races.id |
| runner_id | uuid | FK → runners.id |
| finish_position | int | 1, 2, 3, 4... |
| win_dividend | decimal(10,2) | Official TAB win dividend (nullable if not 1st) |
| place_dividend | decimal(10,2) | Official TAB place dividend (nullable if not placed) |
| is_dead_heat | boolean | Default: false |
| dead_heat_factor | decimal(4,2) | e.g. 0.5 for 2-way dead heat |
| is_protest | boolean | Was result amended via protest |
| source | enum('tab_api','manual') | How the result was entered |
| created_at | timestamptz | |

### tips
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| race_id | uuid | FK → races.id |
| status | enum('active','locked','settled') | |
| submitted_at | timestamptz | |
| updated_at | timestamptz | |
| UNIQUE(user_id, race_id) | | One tip per user per race |

### tip_lines
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tip_id | uuid | FK → tips.id |
| runner_id | uuid | FK → runners.id |
| backup_runner_id | uuid | FK → runners.id (nullable) |
| bet_type | enum('win','place') | |
| amount | decimal(8,2) | e.g. 60.00 |
| is_backup_active | boolean | True if primary was scratched |
| effective_runner_id | uuid | FK → runners.id (resolved: primary or backup) |

**Constraints on tip_lines:**
- Sum of all `amount` for a tip must equal 100.00
- Max 4 tip_lines per tip
- `amount` must be > 0
- `runner_id` and `backup_runner_id` must not be scratched at submission time

### ledger
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| race_id | uuid | FK → races.id |
| tip_id | uuid | FK → tips.id (nullable — null if no tip submitted) |
| stake | decimal(8,2) | Always -100.00 |
| returns | decimal(10,2) | Total returned from winning bets |
| profit | decimal(10,2) | returns + stake (i.e. returns - 100) |
| breakdown | jsonb | Detailed calc per tip_line |
| created_at | timestamptz | |
| UNIQUE(user_id, race_id) | | One entry per user per race |

**Ledger `breakdown` JSON example:**
```json
[
  {
    "tip_line_id": "...",
    "horse": "Giga Kick",
    "bet_type": "win",
    "amount": 60,
    "effective_horse": "Giga Kick",
    "backup_used": false,
    "finish_position": 1,
    "dividend": 4.83,
    "return": 289.80
  },
  {
    "tip_line_id": "...",
    "horse": "Via Sistina",
    "bet_type": "place",
    "amount": 40,
    "effective_horse": "Via Sistina",
    "backup_used": false,
    "finish_position": 2,
    "dividend": 1.60,
    "return": 64.00
  }
]
```

### honour_roll
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| carnival_id | uuid | FK → carnivals.id (nullable for legacy) |
| year | int | e.g. 2024 |
| winner_name | varchar(100) | Display name |
| total_profit | decimal(10,2) | Final P&L |
| runner_up_name | varchar(100) | |
| runner_up_profit | decimal(10,2) | |
| third_name | varchar(100) | |
| third_profit | decimal(10,2) | |
| wooden_spoon_name | varchar(100) | |
| wooden_spoon_profit | decimal(10,2) | |
| notes | text | Any memorable moments |
| created_at | timestamptz | |

### notifications
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| type | varchar(50) | e.g. 'fields_published', 'cutoff_warning', 'result' |
| title | varchar(200) | |
| body | text | |
| is_read | boolean | Default: false |
| created_at | timestamptz | |

### push_subscriptions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users.id |
| endpoint | text | Web Push endpoint URL |
| keys | jsonb | p256dh + auth keys |
| created_at | timestamptz | |

## Indexes

```sql
-- Performance-critical queries
CREATE INDEX idx_tips_user_race ON tips(user_id, race_id);
CREATE INDEX idx_tip_lines_tip ON tip_lines(tip_id);
CREATE INDEX idx_tip_lines_runner ON tip_lines(runner_id);
CREATE INDEX idx_runners_race ON runners(race_id);
CREATE INDEX idx_results_race ON results(race_id);
CREATE INDEX idx_ledger_user ON ledger(user_id);
CREATE INDEX idx_ledger_race ON ledger(race_id);
CREATE INDEX idx_races_round ON races(round_id);
CREATE INDEX idx_rounds_carnival ON rounds(carnival_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
```

## Settlement Calculation (Pseudocode)

```
function settleRace(race, results):
  for each user in carnival:
    tip = getTip(user, race)

    if tip is null:
      createLedger(user, race, stake=-100, returns=0, profit=-100)
      continue

    totalReturns = 0
    breakdown = []

    for each tipLine in tip.tipLines:
      // Resolve effective runner (primary or backup if scratched)
      effectiveRunner = tipLine.runner
      backupUsed = false
      if tipLine.runner.is_scratched and tipLine.backup_runner:
        effectiveRunner = tipLine.backup_runner
        backupUsed = true

      // Check if effective runner is also scratched
      if effectiveRunner.is_scratched:
        // No valid runner — this line returns 0
        continue

      result = results.find(r => r.runner_id == effectiveRunner.id)

      lineReturn = 0
      if tipLine.bet_type == 'win' and result.finish_position == 1:
        lineReturn = tipLine.amount * result.win_dividend
        if result.is_dead_heat:
          lineReturn *= result.dead_heat_factor
      elif tipLine.bet_type == 'place' and result.finish_position <= race.num_place_positions:
        lineReturn = tipLine.amount * result.place_dividend
        if result.is_dead_heat:
          lineReturn *= result.dead_heat_factor

      totalReturns += lineReturn
      breakdown.push({...details})

    profit = totalReturns - 100  // stake is always 100
    createLedger(user, race, stake=-100, returns=totalReturns, profit=profit)
```
