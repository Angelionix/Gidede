#!/bin/bash
# Regenerate test_projects/ artifacts against the running dev server.
# Assumes dev server is already running on http://localhost:3000
set -u

PROJECT_DIR="/home/z/my-project/Gidede"
TEST_DIR="$PROJECT_DIR/test_projects"
API="http://localhost:3000/api/v1"
EMAIL="pipelinetest@gidede.dev"
PASSWORD="pipeline123456"

# Wipe old artifacts (keep directory structure)
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"

echo "============================================"
echo "GIDEDE PIPELINE REGENERATION (no AI, deterministic)"
echo "============================================"

# --- Health check ---
HEALTH=$(curl -s -o /dev/null -w '%{http_code}' $API/health)
if [ "$HEALTH" != "200" ]; then
  echo "FATAL: Server not ready (health=$HEALTH)"
  exit 1
fi
echo "Server ready"

# --- Register or Login ---
curl -s -X POST $API/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Pipeline Tester\"}" > /dev/null 2>&1 || true

LOGIN=$(curl -s -X POST $API/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "FATAL: Login failed"
  exit 1
fi
echo "Logged in as $EMAIL"

# --- 10 test projects ---
NAMES=("Shadow_Depths" "Sky_Fortress" "Rhythm_of_War" "Crystal_Cascade" "Void_Runner" "Card_Lords" "Frostbite" "Star_Blazers" "Harvest_Moonlight" "Nitro_Rush")
DESCS=("A dark roguelike where you descend into procedurally generated dungeons collecting souls" "Tower defense with floating fortresses and aerial waves" "Rhythm game commanding armies by tapping beats" "Puzzle game with rotating crystal grids and chain reactions" "Metroidvania in abandoned space station" "Deck-building card battler with procedural cards" "Survival craft in frozen wasteland managing heat" "Arcade space shooter with weapon evolution" "Farming simulator with seasonal festivals" "Arcade racing with drift and nitro")
GENRES=("RPG" "Tower Defense" "Rhythm" "Puzzle" "Metroidvania" "Strategy" "Sandbox" "Shooter" "Simulation" "Racing")
TYPES=("ecology" "tower_defense" "rhythm" "puzzle" "engine" "economy" "ecology" "engine" "economy" "engine")

SUCCESS=0
FAIL=0

for i in 0 1 2 3 4 5 6 7 8 9; do
  NAME="${NAMES[$i]}"
  DESC="${DESCS[$i]}"
  GENRE="${GENRES[$i]}"
  LTYPE="${TYPES[$i]}"
  NUM=$(printf '%02d' $((i+1)))
  RUN_DIR="$TEST_DIR/${NUM}_${NAME}"
  mkdir -p "$RUN_DIR"

  echo ""
  echo "========================================"
  echo "PROJECT $((i+1))/10: $NAME ($GENRE, $LTYPE)"
  echo "========================================"

  CREATE=$(curl -s -X POST $API/projects \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$NAME\",\"description\":\"$DESC\",\"genre\":\"$GENRE\"}")
  PID=$(echo "$CREATE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$PID" ]; then
    echo "FAIL: create project"
    FAIL=$((FAIL+1))
    continue
  fi
  echo "Project: $PID"
  echo "$CREATE" > "$RUN_DIR/00_project.json"

  echo "  [1/8] Concept..."
  R=$(curl -s -X POST $API/concept/generate \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"idea\":\"$DESC\",\"use_ai\":false}" \
    --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/01_concept.json"

  echo "  [2/8] Core Loop..."
  R=$(curl -s -X POST $API/coreloop/design \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"mechanics\":[\"explore\",\"combat\",\"reward\"],\"desired_loop_type\":\"$LTYPE\",\"use_ai\":false}" \
    --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/02_coreloop.json"

  echo "  [3/8] MDA..."
  R=$(curl -s -X POST $API/mda/analyze \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"target_aesthetics\":[\"challenge\",\"discovery\"],\"use_ai\":false}" \
    --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/03_mda.json"

  echo "  [4/8] Balance..."
  R=$(curl -s -X POST $API/balance/analyze \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"objects\":[{\"id\":\"weapon_basic\",\"name\":\"Базовое оружие\",\"type\":\"weapon\",\"attributes\":{\"power\":30,\"range\":5,\"speed\":7},\"cost\":100,\"tier\":1},{\"id\":\"weapon_advanced\",\"name\":\"Продвинутое оружие\",\"type\":\"weapon\",\"attributes\":{\"power\":60,\"range\":8,\"speed\":5},\"cost\":300,\"tier\":2},{\"id\":\"armor_light\",\"name\":\"Лёгкая броня\",\"type\":\"armor\",\"attributes\":{\"defense\":20,\"mobility\":8},\"cost\":150,\"tier\":1},{\"id\":\"armor_heavy\",\"name\":\"Тяжёлая броня\",\"type\":\"armor\",\"attributes\":{\"defense\":50,\"mobility\":3},\"cost\":400,\"tier\":3}],\"game_mode\":\"pve\",\"use_ai\":false}" \
    --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/04_balance.json"

  echo "  [5/8] Progression..."
  R=$(curl -s -X POST $API/progression/design \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"total_levels\":50,\"use_ai\":false}" \
    --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/05_progression.json"

  echo "  [6/8] Economy..."
  R=$(curl -s -X POST $API/economy/design \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"use_ai\":false}" \
    --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/06_economy.json"

  # First 3 projects: full_gdd format (to exercise the 6 new sections).
  # Remaining 7: one_sheet (matches original script).
  if [ $i -lt 3 ]; then
    GDD_FORMAT="full_gdd"
  else
    GDD_FORMAT="one_sheet"
  fi
  echo "  [7/8] GDD ($GDD_FORMAT)..."
  # R-AUDIT-FIX: GDD route requires playtest evidence gate (R6-10) which
  # blocks generation without an accepted Core Loop + prototype playtest.
  # For test_projects regeneration we pass allow_gdd=true override with a
  # reason so the gate is bypassed deterministically.
  R=$(curl -s -X POST $API/gdd/generate \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"format\":\"$GDD_FORMAT\",\"use_ai\":false,\"playtest_gate_override\":{\"allow_gdd\":true,\"reason\":\"test fixture regeneration — deterministic pipeline test\"}}" \
    --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/07_gdd.json"

  echo "  [8/8] Checklist..."
  R=$(curl -s -X POST $API/gdd/checklist \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\"}" \
    --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/08_checklist.json"

  # Export GDD Markdown
  R=$(curl -s -X POST $API/gdd/export \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"format\":\"md\"}" \
    --max-time 30 2>/dev/null || echo '{}')
  echo "$R" | python3 -c "import sys,json,base64; d=json.load(sys.stdin); print(base64.b64decode(d.get('content','')).decode('utf-8'))" 2>/dev/null > "$RUN_DIR/09_gdd.md" || echo "Export failed" > "$RUN_DIR/09_gdd.md"

  # Prototype 2D
  echo "  Proto 2D..."
  R=$(curl -s -X POST $API/prototypes/generate \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"mode\":\"2d\",\"type\":\"$LTYPE\"}" \
    --max-time 15 2>/dev/null || echo '{}')
  echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('html','No HTML'))" 2>/dev/null > "$RUN_DIR/11_proto_2d.html" || echo "Failed" > "$RUN_DIR/11_proto_2d.html"

  # Prototype 3D
  echo "  Proto 3D..."
  R=$(curl -s -X POST $API/prototypes/generate \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"mode\":\"3d\",\"type\":\"$LTYPE\"}" \
    --max-time 15 2>/dev/null || echo '{}')
  echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('html','No HTML'))" 2>/dev/null > "$RUN_DIR/12_proto_3d.html" || echo "Failed" > "$RUN_DIR/12_proto_3d.html"

  SUCCESS=$((SUCCESS+1))
  echo "DONE: $RUN_DIR"
done

echo ""
echo "============================================"
echo "PIPELINE TEST COMPLETE"
echo "============================================"
echo "Success: $SUCCESS / 10"
echo "Failed:  $FAIL / 10"
echo "Artifacts: $TEST_DIR"
echo ""
echo "=== Projects ==="
for d in $TEST_DIR/*/; do
  [ -d "$d" ] && echo "  $(basename $d): $(ls "$d" | wc -l) files"
done
echo ""
echo "=== Total files ==="
find $TEST_DIR -type f | wc -l
