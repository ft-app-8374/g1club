#!/bin/bash
# Group 1 Club API Integration Tests
BASE="http://localhost:3000"
PASS=0
FAIL=0

red() { echo -e "\033[31m✗ $1\033[0m"; FAIL=$((FAIL+1)); }
green() { echo -e "\033[32m✓ $1\033[0m"; PASS=$((PASS+1)); }

check() {
  if echo "$2" | grep -qF "$3"; then
    green "$1"
  else
    red "$1 — expected '$3', got: $(echo $2 | head -c 120)"
  fi
}

login() {
  local user=$1 pass=$2 jar=$3
  # Get CSRF + initial cookies
  curl -s -c $jar $BASE/api/auth/csrf > /tmp/g1c-csrf.json
  local csrf=$(python3 -c "import json; print(json.load(open('/tmp/g1c-csrf.json'))['csrfToken'])")
  # Login with cookies
  curl -s -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${user}&password=${pass}&csrfToken=${csrf}&callbackUrl=$BASE/dashboard" \
    -b $jar -c $jar -L -o /dev/null 2>&1
}

echo "═══════════════════════════════════════"
echo "  Group 1 Club API Test Suite"
echo "═══════════════════════════════════════"
echo ""

# ─── 1. Health ───
echo "── Health ──"
R=$(curl -s $BASE/api/health)
check "Health endpoint" "$R" '"status":"ok"'

# ─── 2. Auth ───
echo ""
echo "── Auth ──"

login "Dean" "dean2026" "/tmp/g1c-dean"
SESSION=$(curl -s -b /tmp/g1c-dean $BASE/api/auth/session)
check "Dean login (admin)" "$SESSION" '"username":"Dean"'
check "Dean has admin role" "$SESSION" '"role":"admin"'

login "Snake" "snake2026" "/tmp/g1c-snake"
SESSION_S=$(curl -s -b /tmp/g1c-snake $BASE/api/auth/session)
check "Snake login (admin)" "$SESSION_S" '"username":"Snake"'

login "Mills" "mills2026" "/tmp/g1c-mills"
SESSION_M=$(curl -s -b /tmp/g1c-mills $BASE/api/auth/session)
check "Mills login (member)" "$SESSION_M" '"username":"Mills"'

# Bad password
login "Dean" "wrongpass" "/tmp/g1c-bad"
SESSION_BAD=$(curl -s -b /tmp/g1c-bad $BASE/api/auth/session)
check "Bad password rejected" "$SESSION_BAD" '{}'

# ─── 3. Registration ───
echo ""
echo "── Registration ──"

R=$(curl -s -X POST $BASE/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"TestGuy2","email":"test2@test.com","password":"test123","inviteCode":"INVALIDCODE"}')
check "Bad invite code rejected" "$R" '"error"'

# ─── 4. Admin — open race for tipping ───
echo ""
echo "── Admin Race Management ──"
RACE_ID="winx-stakes-2026"

R=$(curl -s -X PATCH -b /tmp/g1c-dean "$BASE/api/admin/races" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"status\":\"open\"}")
check "Admin opens race" "$R" '"status":"open"'

R=$(curl -s -X PATCH -b /tmp/g1c-mills "$BASE/api/admin/races" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"status\":\"closed\"}")
check "Non-admin blocked from race mgmt" "$R" '"Unauthorized"'

# ─── 5. Get runner IDs ───
echo ""
echo "── Tip Submission ──"

RUNNERS=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.runner.findMany({ where: { raceId: '$RACE_ID' }, orderBy: { barrier: 'asc' }, select: { id: true, name: true } })
  .then(r => { console.log(JSON.stringify(r)); p.\$disconnect(); });
")
R1=$(echo $RUNNERS | python3 -c "import sys,json; print(json.loads(sys.stdin.read())[0]['id'])")
R2=$(echo $RUNNERS | python3 -c "import sys,json; print(json.loads(sys.stdin.read())[1]['id'])")
R3=$(echo $RUNNERS | python3 -c "import sys,json; print(json.loads(sys.stdin.read())[2]['id'])")
R4=$(echo $RUNNERS | python3 -c "import sys,json; print(json.loads(sys.stdin.read())[3]['id'])")
R5=$(echo $RUNNERS | python3 -c "import sys,json; print(json.loads(sys.stdin.read())[4]['id'])")
if [ -n "$R1" ]; then green "Runner IDs fetched"; else red "Runner IDs fetched — empty"; fi

# ─── 6. Tip Submission ───
R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/tips" \
  -H "Content-Type: application/json" \
  -d "{
    \"raceId\": \"$RACE_ID\",
    \"lines\": [
      {\"runnerId\": \"$R1\", \"betType\": \"win\", \"amount\": 50, \"backupRunnerId\": \"$R5\"},
      {\"runnerId\": \"$R2\", \"betType\": \"place\", \"amount\": 30},
      {\"runnerId\": \"$R3\", \"betType\": \"win\", \"amount\": 20}
    ]
  }")
check "Dean submits tips (\$100)" "$R" '"tip"'

# Verify stored
R=$(curl -s -b /tmp/g1c-dean "$BASE/api/tips?raceId=$RACE_ID")
check "Dean's tip retrieved" "$R" '"tipLines"'

# Snake tips
R=$(curl -s -X POST -b /tmp/g1c-snake "$BASE/api/tips" \
  -H "Content-Type: application/json" \
  -d "{
    \"raceId\": \"$RACE_ID\",
    \"lines\": [
      {\"runnerId\": \"$R2\", \"betType\": \"win\", \"amount\": 60},
      {\"runnerId\": \"$R4\", \"betType\": \"place\", \"amount\": 40}
    ]
  }")
check "Snake submits tips (\$100)" "$R" '"tip"'

# ─── 7. Tip Validation ───
echo ""
echo "── Tip Validation ──"

R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/tips" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"lines\":[{\"runnerId\":\"$R1\",\"betType\":\"win\",\"amount\":70},{\"runnerId\":\"$R2\",\"betType\":\"win\",\"amount\":50}]}")
check "Over \$100 rejected" "$R" 'must total exactly'

R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/tips" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"lines\":[{\"runnerId\":\"$R1\",\"betType\":\"win\",\"amount\":50}]}")
check "Under \$100 rejected" "$R" 'must total exactly'

R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/tips" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"lines\":[
    {\"runnerId\":\"$R1\",\"betType\":\"win\",\"amount\":20},
    {\"runnerId\":\"$R2\",\"betType\":\"win\",\"amount\":20},
    {\"runnerId\":\"$R3\",\"betType\":\"win\",\"amount\":20},
    {\"runnerId\":\"$R4\",\"betType\":\"win\",\"amount\":20},
    {\"runnerId\":\"$R5\",\"betType\":\"win\",\"amount\":20}
  ]}")
check "Max 4 bets enforced" "$R" 'Maximum 4'

R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/tips" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"lines\":[{\"runnerId\":\"$R1\",\"betType\":\"win\",\"amount\":50},{\"runnerId\":\"$R1\",\"betType\":\"place\",\"amount\":50}]}")
check "Duplicate runners rejected" "$R" 'same horse'

R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/tips" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"lines\":[{\"runnerId\":\"$R1\",\"betType\":\"each-way\",\"amount\":100}]}")
check "Invalid bet type rejected" "$R" 'must be'

R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/tips" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"lines\":[{\"runnerId\":\"$R1\",\"backupRunnerId\":\"$R1\",\"betType\":\"win\",\"amount\":100}]}")
check "Backup=primary rejected" "$R" 'different from primary'

# ─── 8. Manual Settlement ───
echo ""
echo "── Manual Settlement ──"

R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/admin/settle" \
  -H "Content-Type: application/json" \
  -d "{
    \"raceId\": \"$RACE_ID\",
    \"results\": [
      {\"runnerId\": \"$R1\", \"finishPosition\": 1, \"winDividend\": 3.50, \"placeDividend\": 1.60},
      {\"runnerId\": \"$R2\", \"finishPosition\": 2, \"placeDividend\": 1.80},
      {\"runnerId\": \"$R3\", \"finishPosition\": 3, \"placeDividend\": 2.20},
      {\"runnerId\": \"$R4\", \"finishPosition\": 4}
    ]
  }")
check "Admin settles race" "$R" '"settled":true'

R=$(curl -s -X POST -b /tmp/g1c-mills "$BASE/api/admin/settle" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"results\":[]}")
check "Non-admin blocked from settlement" "$R" '"Unauthorized"'

# ─── 9. Verify Settlement ───
echo ""
echo "── Settlement Verification ──"

# Dean: $50 win R1@$3.50=$175 + $30 place R2@$1.80=$54 + $20 win R3(lost)=$0 = $229 - $100 = $129
DEAN_P=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.ledger.findFirst({ where: { raceId: '$RACE_ID', user: { username: 'Dean' } } })
  .then(l => { console.log(l ? l.profit : 'null'); p.\$disconnect(); });
")
check "Dean profit = \$129" "$DEAN_P" "129"

# Snake: $60 win R2(lost) + $40 place R4(4th, no place) = -$100
SNAKE_P=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.ledger.findFirst({ where: { raceId: '$RACE_ID', user: { username: 'Snake' } } })
  .then(l => { console.log(l ? l.profit : 'null'); p.\$disconnect(); });
")
if [ "$SNAKE_P" = "-100" ]; then green "Snake profit = -\$100"; else red "Snake profit — expected -100, got: $SNAKE_P"; fi

# Merc didn't tip = -$100 penalty
MERC_P=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.ledger.findFirst({ where: { raceId: '$RACE_ID', user: { username: 'Merc' } } })
  .then(l => { console.log(l ? l.profit : 'null'); p.\$disconnect(); });
")
if [ "$MERC_P" = "-100" ]; then green "Merc no-tip penalty = -\$100"; else red "Merc penalty — expected -100, got: $MERC_P"; fi

# Race status
RSTATUS=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.race.findUnique({ where: { id: '$RACE_ID' }, select: { status: true } })
  .then(r => { console.log(r.status); p.\$disconnect(); });
")
check "Race status = final" "$RSTATUS" "final"

# ─── 10. Admin APIs ───
echo ""
echo "── Admin APIs ──"

R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/admin/invite")
check "Generate invite code" "$R" '"code"'

R=$(curl -s -X POST -b /tmp/g1c-mills "$BASE/api/admin/invite")
check "Non-admin blocked from invites" "$R" '"Unauthorized"'

CARNIVAL_ID=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.carnival.findFirst({ select: { id: true } })
  .then(c => { console.log(c.id); p.\$disconnect(); });
")
R=$(curl -s -X PATCH -b /tmp/g1c-dean "$BASE/api/admin/carnival" \
  -H "Content-Type: application/json" \
  -d "{\"carnivalId\":\"$CARNIVAL_ID\",\"status\":\"active\"}")
check "Activate carnival" "$R" '"status":"active"'

# ─── 11. Cron Routes ───
echo ""
echo "── Cron Routes ──"

CRON_AUTH="Authorization: Bearer dev-cron-secret-2026"

R=$(curl -s -X POST -H "$CRON_AUTH" "$BASE/api/cron/open-races")
check "open-races cron" "$R" '"message"'

R=$(curl -s -X POST -H "$CRON_AUTH" "$BASE/api/cron/send-notifications")
check "send-notifications cron" "$R" '"message"'

R=$(curl -s -X POST -H "$CRON_AUTH" "$BASE/api/cron/close-races")
check "close-tips cron" "$R" '"message"'

# Verify cron rejects unauthenticated requests
R=$(curl -s -X POST "$BASE/api/cron/open-races")
check "Cron rejects no auth" "$R" '"Unauthorized"'

# ─── 12. Post-Settlement Lockout ───
echo ""
echo "── Post-Settlement Lockout ──"

R=$(curl -s -X POST -b /tmp/g1c-dean "$BASE/api/tips" \
  -H "Content-Type: application/json" \
  -d "{\"raceId\":\"$RACE_ID\",\"lines\":[{\"runnerId\":\"$R1\",\"betType\":\"win\",\"amount\":100}]}")
check "Tip on settled race rejected" "$R" '"error"'

R=$(curl -s -X DELETE -b /tmp/g1c-dean "$BASE/api/tips?raceId=$RACE_ID")
check "Delete tip on settled race rejected" "$R" '"error"'

# ─── Summary ───
echo ""
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"

exit $FAIL
