#!/bin/bash
set -e

PROJECT_DIR="/home/z/my-project"
TEST_DIR="$PROJECT_DIR/test_projects"
API="http://localhost:3000/api/v1"
EMAIL="pipelinetest@gidede.dev"
PASSWORD="pipeline123456"

mkdir -p "$TEST_DIR"

echo "============================================"
echo "GIDEDE PIPELINE TEST — 10 projects with AI"
echo "============================================"

# --- Start dev server ---
cd "$PROJECT_DIR"
pkill -9 -f "next" 2>/dev/null; sleep 2
rm -f dev.log
nohup env NODE_OPTIONS="--max-old-space-size=2048" bun run dev </dev/null >dev.log 2>&1 &
disown
sleep 12

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

  # Create project
  CREATE=$(curl -s -X POST $API/projects/ \
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

  # Step 1: Concept (AI)
  echo "  [1/8] Concept (AI)..."
  R=$(curl -s -X POST $API/concept/generate \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"idea\":\"$DESC\",\"use_ai\":true}" \
    --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/01_concept.json"

  # Step 2: Core Loop (AI)
  echo "  [2/8] Core Loop (AI)..."
  R=$(curl -s -X POST $API/coreloop/design \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"mechanics\":[\"explore\",\"combat\",\"reward\"],\"desired_loop_type\":\"$LTYPE\",\"use_ai\":true}" \
    --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/02_coreloop.json"

  # Step 3: MDA (AI)
  echo "  [3/8] MDA (AI)..."
  R=$(curl -s -X POST $API/mda/analyze \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"target_aesthetics\":[\"challenge\",\"discovery\"],\"use_ai\":true}" \
    --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/03_mda.json"

  # Step 4: Balance (AI)
  echo "  [4/8] Balance (AI)..."
  # TASK-4.1 FIXED: was 'elements' (wrong field, ignored by route → 422 for all 10 test_projects).
  # Now sends 'objects' with proper BalanceObject shape: {id, name, type, attributes, cost, tier}.
  # Also sends 4 objects (≥2 required) with genre from concept for better balance analysis.
  R=$(curl -s -X POST $API/balance/analyze \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"objects\":[{\"id\":\"weapon_basic\",\"name\":\"Базовое оружие\",\"type\":\"weapon\",\"attributes\":{\"power\":30,\"range\":5,\"speed\":7},\"cost\":100,\"tier\":1},{\"id\":\"weapon_advanced\",\"name\":\"Продвинутое оружие\",\"type\":\"weapon\",\"attributes\":{\"power\":60,\"range\":8,\"speed\":5},\"cost\":300,\"tier\":2},{\"id\":\"armor_light\",\"name\":\"Лёгкая броня\",\"type\":\"armor\",\"attributes\":{\"defense\":20,\"mobility\":8},\"cost\":150,\"tier\":1},{\"id\":\"armor_heavy\",\"name\":\"Тяжёлая броня\",\"type\":\"armor\",\"attributes\":{\"defense\":50,\"mobility\":3},\"cost\":400,\"tier\":3}],\"game_mode\":\"pve\",\"use_ai\":true}" \
    --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/04_balance.json"

  # Step 5: Progression (AI)
  echo "  [5/8] Progression (AI)..."
  R=$(curl -s -X POST $API/progression/design \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"total_levels\":50,\"use_ai\":true}" \
    --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/05_progression.json"

  # Step 6: Economy (AI)
  echo "  [6/8] Economy (AI)..."
  R=$(curl -s -X POST $API/economy/design \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"use_ai\":true}" \
    --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/06_economy.json"

  # Step 7: GDD (AI)
  echo "  [7/8] GDD (AI)..."
  R=$(curl -s -X POST $API/gdd/generate \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"format\":\"one_sheet\",\"use_ai\":true}" \
    --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/07_gdd.json"

  # Step 8: Checklist
  echo "  [8/8] Checklist..."
  R=$(curl -s -X POST $API/gdd/checklist \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\"}" \
    --max-time 30 2>/dev/null || echo '{"error":"timeout"}')
  echo "$R" > "$RUN_DIR/08_checklist.json"

  # Export GDD Markdown
  echo "  Export MD..."
  R=$(curl -s -X POST $API/gdd/export \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"format\":\"md\"}" \
    --max-time 30 2>/dev/null || echo '{}')
  echo "$R" | python3 -c "import sys,json,base64; d=json.load(sys.stdin); print(base64.b64decode(d.get('content','')).decode('utf-8'))" 2>/dev/null > "$RUN_DIR/09_gdd_export.md" || echo "Export failed" > "$RUN_DIR/09_gdd_export.md"

  # Export GDD HTML
  echo "  Export HTML..."
  R=$(curl -s -X POST $API/gdd/export \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"format\":\"html\"}" \
    --max-time 30 2>/dev/null || echo '{}')
  echo "$R" | python3 -c "import sys,json,base64; d=json.load(sys.stdin); print(base64.b64decode(d.get('content','')).decode('utf-8'))" 2>/dev/null > "$RUN_DIR/10_gdd_export.html" || echo "Export failed" > "$RUN_DIR/10_gdd_export.html"

  # Prototype 2D
  echo "  Proto 2D ($LTYPE)..."
  R=$(curl -s -X POST $API/prototypes/generate \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"mode\":\"2d\",\"type\":\"$LTYPE\"}" \
    --max-time 15 2>/dev/null || echo '{}')
  echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('html','No HTML'))" 2>/dev/null > "$RUN_DIR/11_prototype_2d.html" || echo "Failed" > "$RUN_DIR/11_prototype_2d.html"

  # Prototype 3D
  echo "  Proto 3D ($LTYPE)..."
  R=$(curl -s -X POST $API/prototypes/generate \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"mode\":\"3d\",\"type\":\"$LTYPE\"}" \
    --max-time 15 2>/dev/null || echo '{}')
  echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('html','No HTML'))" 2>/dev/null > "$RUN_DIR/12_prototype_3d.html" || echo "Failed" > "$RUN_DIR/12_prototype_3d.html"

  # Prototype with AI insights
  echo "  Proto AI insights..."
  R=$(curl -s -X POST $API/prototypes/generate \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"mode\":\"2d\",\"type\":\"$LTYPE\",\"use_ai\":true}" \
    --max-time 60 2>/dev/null || echo '{}')
  echo "$R" > "$RUN_DIR/13_prototype_ai.json"

  # AI insights summary
  echo "  --- AI Summary ---"
  for f in 01_concept 02_coreloop 03_mda 04_balance 05_progression 06_economy 07_gdd 13_prototype_ai; do
    HAS=$(python3 -c "
import json
try:
    d=json.load(open('$RUN_DIR/${f}.json'))
    ai = d.get('ai_insights') or d.get('generation_metadata',{}).get('ai_insights') or ''
    print('YES' if ai else 'NO')
except:
    print('ERR')
" 2>/dev/null || echo 'ERR')
    echo "    $f: AI=$HAS"
  done

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
