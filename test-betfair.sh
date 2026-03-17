#!/bin/bash
# Betfair API Test Script
# Run this from a residential IP / local machine (Betfair blocks datacenter IPs)
#
# Prerequisites:
#   1. Set BETFAIR_USERNAME and BETFAIR_PASSWORD in .env
#   2. Run: source .env
#   3. Run: bash test-betfair.sh
#
# This tests: login → market catalogue → market book (fields + results)

API_KEY="${BETFAIR_API_KEY}"
if [ -z "$API_KEY" ]; then
  echo "Set BETFAIR_API_KEY in .env first"
  exit 1
fi
BF_USER="${BETFAIR_USERNAME}"
BF_PASS="${BETFAIR_PASSWORD}"
API="https://api.betfair.com/exchange/betting/rest/v1.0"

red() { echo -e "\033[31m✗ $1\033[0m"; }
green() { echo -e "\033[32m✓ $1\033[0m"; }

if [ -z "$BF_USER" ] || [ -z "$BF_PASS" ]; then
  echo "Set BETFAIR_USERNAME and BETFAIR_PASSWORD in .env first"
  exit 1
fi

echo "═══════════════════════════════════"
echo "  Betfair API Test"
echo "═══════════════════════════════════"
echo ""

# 1. Login
echo "── Login ──"
LOGIN=$(curl -s -X POST "https://identitysso.betfair.com/api/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Application: $API_KEY" \
  -H "Accept: application/json" \
  -d "username=${BF_USER}&password=${BF_PASS}")

TOKEN=$(echo $LOGIN | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
STATUS=$(echo $LOGIN | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)

if [ "$STATUS" = "SUCCESS" ]; then
  green "Login successful (token: ${TOKEN:0:20}...)"
else
  red "Login failed: $LOGIN"
  exit 1
fi

# 2. List AU horse racing markets (upcoming)
echo ""
echo "── Market Catalogue (AU Horse Racing) ──"

TODAY=$(date -u +%Y-%m-%dT00:00:00Z)
WEEK=$(date -u -d "+7 days" +%Y-%m-%dT23:59:59Z 2>/dev/null || date -u -v+7d +%Y-%m-%dT23:59:59Z)

MARKETS=$(curl -s -X POST "$API/listMarketCatalogue/" \
  -H "Content-Type: application/json" \
  -H "X-Application: $API_KEY" \
  -H "X-Authentication: $TOKEN" \
  -d "{
    \"filter\": {
      \"eventTypeIds\": [\"7\"],
      \"marketCountries\": [\"AU\"],
      \"marketTypeCodes\": [\"WIN\"],
      \"marketStartTime\": {\"from\": \"$TODAY\", \"to\": \"$WEEK\"}
    },
    \"marketProjection\": [\"RUNNER_METADATA\", \"MARKET_START_TIME\", \"EVENT\", \"MARKET_DESCRIPTION\"],
    \"maxResults\": 10,
    \"sort\": \"FIRST_TO_START\"
  }")

MARKET_COUNT=$(echo $MARKETS | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)

if [ "$MARKET_COUNT" -gt 0 ] 2>/dev/null; then
  green "Found $MARKET_COUNT markets"
  echo ""
  echo "  Sample markets:"
  echo $MARKETS | python3 -c "
import sys, json
markets = json.load(sys.stdin)
for m in markets[:5]:
    venue = m.get('event',{}).get('venue','?')
    runners = len(m.get('runners',[]))
    name = m.get('marketName','?')
    start = m.get('marketStartTime','?')[:16]
    print(f'    {start}  {venue} — {name} ({runners} runners)')
" 2>/dev/null
else
  red "No markets found (or error): ${MARKETS:0:200}"
fi

# 3. Get runners for first market
echo ""
echo "── Runner Details (First Market) ──"

FIRST_MARKET=$(echo $MARKETS | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['marketId'])" 2>/dev/null)

if [ -n "$FIRST_MARKET" ]; then
  echo $MARKETS | python3 -c "
import sys, json
m = json.load(sys.stdin)[0]
print(f'  Market: {m[\"marketName\"]} ({m[\"event\"][\"venue\"]})')
print(f'  Runners:')
for r in m.get('runners',[]):
    name = r.get('runnerName','?')
    jockey = r.get('metadata',{}).get('JOCKEY_NAME','?')
    trainer = r.get('metadata',{}).get('TRAINER_NAME','?')
    barrier = r.get('metadata',{}).get('STALL_DRAW','?')
    print(f'    {barrier}. {name} (J: {jockey}, T: {trainer})')
" 2>/dev/null
  green "Runner metadata available"
else
  red "Could not get first market"
fi

# 4. Get market book (BSP / status)
echo ""
echo "── Market Book (BSP / Status) ──"

if [ -n "$FIRST_MARKET" ]; then
  BOOK=$(curl -s -X POST "$API/listMarketBook/" \
    -H "Content-Type: application/json" \
    -H "X-Application: $API_KEY" \
    -H "X-Authentication: $TOKEN" \
    -d "{
      \"marketIds\": [\"$FIRST_MARKET\"],
      \"priceProjection\": {\"priceData\": [\"SP_TRADED\"]}
    }")

  MARKET_STATUS=$(echo $BOOK | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['status'])" 2>/dev/null)
  green "Market status: $MARKET_STATUS"

  echo $BOOK | python3 -c "
import sys, json
book = json.load(sys.stdin)[0]
for r in book.get('runners',[])[:5]:
    sid = r['selectionId']
    status = r.get('status','?')
    sp = r.get('sp',{}).get('nearPrice','N/A')
    print(f'    Selection {sid}: status={status}, BSP near={sp}')
" 2>/dev/null
fi

# 5. Search for Group 1 markets specifically
echo ""
echo "── Group 1 Markets ──"

G1_MARKETS=$(curl -s -X POST "$API/listMarketCatalogue/" \
  -H "Content-Type: application/json" \
  -H "X-Application: $API_KEY" \
  -H "X-Authentication: $TOKEN" \
  -d "{
    \"filter\": {
      \"eventTypeIds\": [\"7\"],
      \"marketCountries\": [\"AU\"],
      \"marketTypeCodes\": [\"WIN\"],
      \"marketStartTime\": {\"from\": \"$TODAY\", \"to\": \"$WEEK\"}
    },
    \"marketProjection\": [\"MARKET_START_TIME\", \"EVENT\"],
    \"maxResults\": 50,
    \"sort\": \"FIRST_TO_START\"
  }")

echo $G1_MARKETS | python3 -c "
import sys, json, re
markets = json.load(sys.stdin)
g1 = [m for m in markets if re.search(r'Grp1', m.get('marketName',''), re.I)]
print(f'  Total WIN markets: {len(markets)}')
print(f'  Group 1 markets: {len(g1)}')
for m in g1[:5]:
    venue = m.get('event',{}).get('venue','?')
    print(f'    {m[\"marketName\"]} @ {venue}')
" 2>/dev/null

echo ""
echo "═══════════════════════════════════"
echo "  Test complete"
echo "═══════════════════════════════════"
