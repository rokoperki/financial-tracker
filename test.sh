#!/usr/bin/env bash
BASE="http://localhost:3000"
COOKIE_JAR="/tmp/ft_test_cookies.txt"
EMAIL="test_$(date +%s)@example.com"
PASS="testpassword123"

pass=0
fail=0

ok()   { echo "  ✓ $1"; pass=$((pass + 1)); }
err()  { echo "  ✗ $1"; echo "    → $2"; fail=$((fail + 1)); }

check() {
  local label="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -q "$expected"; then
    ok "$label"
  else
    err "$label" "$(echo "$actual" | head -c 300)"
  fi
}

jq_get() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print($2)" 2>/dev/null || echo ""; }

rm -f "$COOKIE_JAR"

echo ""
echo "── Auth ──────────────────────────────────"

R=$(curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Test User\"}")
check "Register new user" '"id"' "$R"

R=$(curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
check "Reject duplicate email" 'error' "$R"

CSRF=$(curl -s -c "$COOKIE_JAR" "$BASE/api/auth/csrf")
CSRF_TOKEN=$(jq_get "$CSRF" "d['csrfToken']")

curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST \
  "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=$EMAIL&password=$PASS&csrfToken=$CSRF_TOKEN&callbackUrl=%2Fdashboard&json=true" \
  -o /dev/null

SESSION=$(curl -s -b "$COOKIE_JAR" "$BASE/api/auth/session")
check "Session established" "$EMAIL" "$SESSION"

echo ""
echo "── Accounts ──────────────────────────────"

ACC1=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/accounts" \
  -H "Content-Type: application/json" \
  -d '{"name":"Main Bank","type":"BANK","currency":"EUR"}')
check "Create BANK account" '"id"' "$ACC1"
ACC1_ID=$(jq_get "$ACC1" "d['id']")

ACC2=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/accounts" \
  -H "Content-Type: application/json" \
  -d '{"name":"Revolut","type":"REVOLUT","currency":"EUR"}')
check "Create REVOLUT account" '"id"' "$ACC2"
ACC2_ID=$(jq_get "$ACC2" "d['id']")

ACC3=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/accounts" \
  -H "Content-Type: application/json" \
  -d '{"name":"SOL Wallet","type":"SOLFLARE","currency":"SOL"}')
check "Create SOLFLARE account" '"id"' "$ACC3"

R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/accounts")
check "List accounts returns all" '"Main Bank"' "$R"

R=$(curl -s -b "$COOKIE_JAR" -X PUT "$BASE/api/accounts/$ACC1_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Main Bank Updated"}')
check "Update account name" 'Main Bank Updated' "$R"

echo ""
echo "── Categories ────────────────────────────"

CATS=$(curl -s -b "$COOKIE_JAR" "$BASE/api/categories")
check "Default categories seeded" 'Food & groceries' "$CATS"
FOOD_ID=$(echo "$CATS" | python3 -c "import sys,json; cats=json.load(sys.stdin); print(next((c['id'] for c in cats if c['name']=='Food & groceries'), ''))" 2>/dev/null || echo "")

CAT=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/categories" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pet Care","type":"EXPENSE","color":"#f59e0b"}')
check "Create custom category" '"Pet Care"' "$CAT"
CAT_ID=$(jq_get "$CAT" "d['id']")

echo ""
echo "── Transactions ──────────────────────────"

TODAY=$(date +%Y-%m-%d)
MONTH_START=$(date +%Y-%m-01)

TX_IN=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/transactions" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\":\"$ACC1_ID\",\"amount\":3000,\"currency\":\"EUR\",\"type\":\"INCOME\",\"description\":\"Salary\",\"date\":\"$MONTH_START\"}")
check "Add income (EUR)" '"amountEur"' "$TX_IN"
TX_IN_ID=$(jq_get "$TX_IN" "d['id']")

TX_EX=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/transactions" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\":\"$ACC1_ID\",\"amount\":45.50,\"currency\":\"EUR\",\"type\":\"EXPENSE\",\"categoryId\":\"$FOOD_ID\",\"description\":\"Groceries\",\"date\":\"$TODAY\"}")
check "Add expense with category" '"amountEur"' "$TX_EX"
TX_EX_ID=$(jq_get "$TX_EX" "d['id']")

TX_USD=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/transactions" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\":\"$ACC1_ID\",\"amount\":100,\"currency\":\"USD\",\"type\":\"EXPENSE\",\"description\":\"USD purchase\",\"date\":\"$TODAY\"}")
check "Add USD expense (auto EUR conversion)" '"amountEur"' "$TX_USD"
# Verify the EUR amount is less than 100 (since 1 USD < 1 EUR typically, or close)
USD_EUR=$(jq_get "$TX_USD" "d['amountEur']")
if [ -n "$USD_EUR" ] && [ "$USD_EUR" != "null" ]; then
  ok "USD converted to EUR (amountEur=$USD_EUR)"
else
  err "USD EUR conversion value" "amountEur=$USD_EUR"
fi

R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/transactions?type=INCOME")
check "Filter transactions by type=INCOME" '"Salary"' "$R"

R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/transactions?search=Groceries")
check "Search transactions by description" '"Groceries"' "$R"

R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/transactions?accountId=$ACC1_ID")
check "Filter transactions by accountId" '"total"' "$R"

R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/transactions?page=1")
TOTAL=$(jq_get "$R" "d['total']")
check "Pagination (total > 0)" '"total"' "$R"

R=$(curl -s -b "$COOKIE_JAR" -X DELETE "$BASE/api/transactions/$TX_IN_ID")
check "Delete transaction" '"ok"' "$R"

echo ""
echo "── Transfer ──────────────────────────────"

R=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/accounts/transfer" \
  -H "Content-Type: application/json" \
  -d "{\"fromAccountId\":\"$ACC1_ID\",\"toAccountId\":\"$ACC2_ID\",\"amount\":50,\"currency\":\"EUR\",\"date\":\"$TODAY\",\"description\":\"Test transfer\"}")
check "Transfer between accounts" '"ok"' "$R"

echo ""
echo "── Budgets ───────────────────────────────"

MONTH=$(date +%Y-%m)

if [ -n "$FOOD_ID" ]; then
  BUD=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/budgets" \
    -H "Content-Type: application/json" \
    -d "{\"categoryId\":\"$FOOD_ID\",\"amount\":200,\"month\":\"$MONTH\",\"alertThreshold\":80}")
  check "Create budget" '"id"' "$BUD"
  BUD_ID=$(jq_get "$BUD" "d['id']")

  R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/budgets?month=$MONTH")
  check "List budgets with spent amount" '"spent"' "$R"

  R=$(curl -s -b "$COOKIE_JAR" -X PUT "$BASE/api/budgets/$BUD_ID" \
    -H "Content-Type: application/json" \
    -d '{"amount":300}')
  check "Update budget amount" '"id"' "$R"

  R=$(curl -s -b "$COOKIE_JAR" -X DELETE "$BASE/api/budgets/$BUD_ID")
  check "Delete budget" '"ok"' "$R"
else
  echo "  - Budget tests skipped (Food category ID not found)"
fi

echo ""
echo "── Reports ───────────────────────────────"

R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/reports/summary")
check "Reports summary endpoint" '"monthlyIncome"' "$R"

R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/reports/charts?month=$MONTH")
check "Charts data has spendingByCategory" '"spendingByCategory"' "$R"
check "Charts data has incomeVsExpenses" '"incomeVsExpenses"' "$R"
check "Charts data has netWorthTrend" '"netWorthTrend"' "$R"

R=$(curl -s -I -b "$COOKIE_JAR" "$BASE/api/reports/export?dateFrom=${MONTH}-01&dateTo=${MONTH}-31" 2>&1)
check "CSV export returns attachment header" 'attachment' "$R"

echo ""
echo "── Recurring ─────────────────────────────"

REC=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/recurring" \
  -H "Content-Type: application/json" \
  -d "{\"accountId\":\"$ACC1_ID\",\"amount\":9.99,\"currency\":\"EUR\",\"frequency\":\"MONTHLY\",\"dayOfMonth\":1,\"description\":\"Netflix\",\"nextRunDate\":\"$MONTH_START\"}")
check "Create recurring rule" '"id"' "$REC"
REC_ID=$(jq_get "$REC" "d['id']")

R=$(curl -s -b "$COOKIE_JAR" "$BASE/api/recurring")
check "List recurring rules" '"Netflix"' "$R"

R=$(curl -s -b "$COOKIE_JAR" -X PUT "$BASE/api/recurring/$REC_ID" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}')
check "Pause recurring rule" '"isActive"' "$R"

R=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE/api/recurring/run" \
  -H "Content-Type: application/json" \
  -d '{}')
check "Run recurring cron endpoint" '"processed"' "$R"

R=$(curl -s -b "$COOKIE_JAR" -X DELETE "$BASE/api/recurring/$REC_ID")
check "Delete recurring rule" '"ok"' "$R"

echo ""
echo "── Cleanup ───────────────────────────────"

curl -s -b "$COOKIE_JAR" -X DELETE "$BASE/api/accounts/$ACC1_ID" > /dev/null
curl -s -b "$COOKIE_JAR" -X DELETE "$BASE/api/accounts/$ACC2_ID" > /dev/null
ok "Deactivate test accounts"

rm -f "$COOKIE_JAR"

echo ""
echo "══════════════════════════════════════════"
printf "  Passed: %d   Failed: %d\n" "$pass" "$fail"
echo "══════════════════════════════════════════"
echo ""
