# Group 1 Club — Data Sources & API Integration

## Primary Source: Betfair Exchange API (Free)

### Access
- **Account**: Free Betfair Australia account (betfair.com.au)
- **Key type**: Delayed developer key (free, self-generated, instant)
- **Auth**: SSOID token + app key
- **Delay**: 1-180 seconds on live price data (irrelevant for our use case)
- **Cost**: $0
- **No betting requirement**: Developer key is explicitly for read-only / testing use
- **Data retention**: Settled market data available for 90 days

### What We Get

| Data | Endpoint | When |
|------|----------|------|
| Race fields (runners) | `listMarketCatalogue` | Days before race |
| Runner metadata (jockey, trainer, weight, barrier) | `listMarketCatalogue` with `RUNNER_METADATA` projection | Days before race |
| Scratchings | `listMarketBook` — runner status = `REMOVED` | Race day polling |
| Results (win/lose) | `listMarketBook` after settlement | Minutes after race |
| Win BSP | `listMarketBook` with `SP_TRADED` projection | After settlement |
| Place BSP | Same, on PLACE market (separate marketId) | After settlement |

### Market Name Format (ANZ)
```
R7 3200m Grp1     ← Group 1
R4 1600m Grp2     ← Group 2
R3 1200m Hcap     ← Handicap
R1 1400m Mdn      ← Maiden
```
The `Grp1` tag is consistent and machine-parseable.

### Key API Calls

#### 1. Discover Group 1 Markets
```python
# Find all Group 1 WIN markets at Flemington on Nov 3, 2026
filter = {
    "eventTypeIds": ["7"],           # Horse racing
    "marketCountries": ["AU"],       # Australia
    "marketTypeCodes": ["WIN"],      # Win markets
    "venues": ["Flemington"],        # Specific venue
    "marketStartTime": {
        "from": "2026-11-03T00:00:00Z",
        "to": "2026-11-03T23:59:59Z"
    }
}
result = api.listMarketCatalogue(
    filter=filter,
    marketProjection=["RUNNER_METADATA", "MARKET_START_TIME"],
    maxResults=50
)
# Parse market names for "Grp1" to identify Group 1 races
group1_markets = [m for m in result if "Grp1" in m.marketName]
```

#### 2. Get Runners (Fields)
```python
# Runners are included in listMarketCatalogue response
for market in group1_markets:
    for runner in market.runners:
        # runner.runnerName = "GRINGOTTS"
        # runner.metadata.JOCKEY_NAME = "C Williams"
        # runner.metadata.TRAINER_NAME = "C Maher & D Eustace"
        # runner.metadata.WEIGHT_VALUE = "57.0"
        # runner.metadata.STALL_DRAW = "7"  (barrier)
```

#### 3. Check Scratchings
```python
# Poll listMarketBook for runner status changes
book = api.listMarketBook(marketIds=[market_id])
for runner in book.runners:
    if runner.status == "REMOVED":
        # Horse is scratched
```

#### 4. Get Results + BSP After Race
```python
# After market settles
book = api.listMarketBook(
    marketIds=[win_market_id],
    priceProjection={"priceData": ["SP_TRADED"]}
)
for runner in book.runners:
    if runner.status == "WINNER":
        bsp = runner.sp.nearPrice  # Betfair Starting Price
    elif runner.status == "LOSER":
        pass
    elif runner.status == "REMOVED":
        pass  # Scratched

# Repeat for PLACE market
place_book = api.listMarketBook(
    marketIds=[place_market_id],
    priceProjection={"priceData": ["SP_TRADED"]}
)
```

### Settlement Price: Betfair SP (BSP)

BSP is a market-derived starting price with no bookmaker margin. It is typically:
- **~10%+ higher** than TAB best tote dividends
- More favourable for longer-priced runners
- Well-calibrated (implied probability matches actual win rates)
- Available for both WIN and PLACE markets in Australian racing

**For the competition**: BSP is used as the settlement price. Since all participants are scored against the same price, relative rankings are fair. The 2025 competition already used Betfair SP.

### Scratchings Reliability

Betfair's scratching data (runner status = `REMOVED`) is **not 100% reliable**. Supplementary sources:
- **Racing Australia FreeFields**: `racingaustralia.horse/FreeFields/Scratchings.aspx` (scrapeable, predictable URLs)
- **Admin manual entry**: Fallback for edge cases

## Race Calendar Source

### Approach: Hardcoded Calendar + Betfair Auto-Match

The Group 1 race calendar is published months before the carnival. We:

1. **Pre-populate** the race calendar from known sources (races.com.au, justhorseracing.com.au)
2. **Auto-match** each race to its Betfair market by venue + date + `Grp1` tag
3. **Store the `marketId`** for direct lookups (fields, results, BSP)

### 2025 Spring Carnival Group 1 Races (Reference for 2026)

#### Sydney (Randwick / Rosehill) — 8 Races

| Date (2025) | Race | Venue | Distance |
|-------------|------|-------|----------|
| Aug 24 | Winx Stakes | Randwick | 1400m |
| Sep 27 | Golden Rose Stakes | Rosehill | 1400m |
| Oct 4 | Epsom Handicap | Randwick | 1600m |
| Oct 4 | The Metropolitan | Randwick | 2400m |
| Oct 4 | Flight Stakes | Randwick | 1600m |
| Oct 18 | The Everest | Randwick | 1200m |
| Oct 18 | King Charles III Stakes | Randwick | 1600m |
| Oct 25 | Spring Champion Stakes | Randwick | 2000m |

#### Melbourne (Caulfield / Flemington / Moonee Valley) — 21 Races

| Date (2025) | Race | Venue | Distance |
|-------------|------|-------|----------|
| Aug 30 | Memsie Stakes | Caulfield | 1400m |
| Sep 6 | Moir Stakes | Moonee Valley | 1000m |
| Sep 13 | Makybe Diva Stakes | Flemington | 1600m |
| Sep 20 | Sir Rupert Clarke Stakes | Caulfield | 1400m |
| Sep 20 | Underwood Stakes | Caulfield | 1800m |
| Sep 26 | Manikato Stakes | Moonee Valley | 1200m |
| Oct 4 | Turnbull Stakes | Flemington | 2000m |
| Oct 11 | Caulfield Guineas | Caulfield | 1600m |
| Oct 11 | Caulfield Stakes | Caulfield | 2000m |
| Oct 11 | Toorak Handicap | Caulfield | 1600m |
| Oct 18 | Thousand Guineas | Caulfield | 1600m |
| Oct 18 | Caulfield Cup | Caulfield | 2400m |
| Oct 25 | Cox Plate | Moonee Valley | 2040m |
| Nov 1 | Coolmore Stud Stakes | Flemington | 1200m |
| Nov 1 | Victoria Derby | Flemington | 2500m |
| Nov 1 | Empire Rose Stakes | Flemington | 1600m |
| Nov 4 | Melbourne Cup | Flemington | 3200m |
| Nov 6 | VRC Oaks | Flemington | 2500m |
| Nov 8 | Champions Stakes | Flemington | 2000m |
| Nov 8 | Champions Sprint | Flemington | 1200m |
| Nov 8 | Champions Mile | Flemington | 1600m |

**Total: 29 Group 1 races** (some may be excluded from the competition at admin's discretion)

### 2026 Date Projection
- Melbourne Cup: **Tuesday 3 November 2026** (first Tuesday in November)
- Other races shift by 1-2 days to match 2026 calendar
- Exact dates published by Racing Victoria / Racing NSW by ~May 2026
- Admin updates the calendar once dates are confirmed; Betfair auto-matching handles the rest

## Polling Strategy

### Pre-Race Day (Field Loading)
```
Schedule: Daily at 6:00 AM AEST during carnival season
Trigger:  EventBridge cron rule

Logic:
  For each upcoming race in the next 7 days:
    1. Query Betfair: listMarketCatalogue for venue + date
    2. Filter for Grp1 markets
    3. Match to our DB race by venue + date + distance
    4. Store marketId (WIN + PLACE)
    5. Extract runners from catalogue response
    6. Upsert runners into DB
    7. If new field found → push notification: "Fields up for [Race Day]"
```

### Race Day (Scratchings)
```
Schedule: Every 15 minutes from 7 AM, every 5 minutes from 2 hours before first race
Trigger:  EventBridge cron rule (race days only)

Logic:
  For each race today:
    1. Query Betfair: listMarketBook for stored marketId
    2. Check runner statuses
    3. Flag newly REMOVED runners as scratched in DB
    4. Cross-reference with Racing Australia scratchings page
    5. If user's primary pick scratched AND before cutoff:
       → Push notification: "Your pick [Horse] scratched — update your tip"
    6. If user's primary pick scratched AND after cutoff:
       → Auto-activate backup tip
       → Notify user: "Backup [Horse] activated for [Race]"
```

### Post-Race (Settlement)
```
Schedule: Every 60 seconds, starting from scheduled jump time + 5 minutes
Trigger:  EventBridge per-race cron
Timeout:  Stop after 30 minutes (flag for admin manual review)

Logic:
  1. Query Betfair: listMarketBook for WIN marketId (with SP_TRADED)
  2. If market status != CLOSED → retry in 60s
  3. If market CLOSED:
     a. Extract finishing positions (WINNER/LOSER/REMOVED)
     b. Extract BSP for winner (win market)
     c. Query PLACE marketId for place BSPs
     d. Store results in DB
     e. Run settlement calculation for all users
     f. Update leaderboard
     g. Push notification: "[Race] settled — check the leaderboard!"
     h. Mark race as settled, cancel further polling
```

## Fallback: Manual Entry

If Betfair API is unavailable or data is delayed:
1. Admin → Manual Override
2. Select race
3. Enter finishing positions (1st, 2nd, 3rd)
4. Enter dividends (sourced from betfair.com.au or tab.com.au website)
5. Triggers settlement calculation
6. Results marked as `source: 'manual'`

## Fallback: TAB Studio API

If Betfair proves insufficient (e.g. BSP not available for a race):
- Apply for TAB Studio API access (studio.tab.com.au/register/individual)
- Provides official TAB tote dividends
- Requires TAB betting account + approval (~2-3 days)
- Personal use tier (non-commercial)
- Would replace BSP with official dividends for settlement

## Rate Limiting

Betfair API: No published rate limit for delayed key, but be conservative:
- Max 5 requests per second
- Cache field data for 1 hour (pre-race day)
- Cache scratching data for 5 minutes (race day)
- Log all API calls for debugging
