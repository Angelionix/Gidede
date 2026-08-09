#!/bin/bash
# Download books from python-original branch via GitHub raw URL.
# Books are stored as Git LFS objects, so we need to download them directly.
#
# Usage:
#   GITHUB_TOKEN=your_token bash scripts/ontology/download-books.sh
#   # or set GITHUB_TOKEN in .env

set -e

REPO="Angelionix/Gidede"
BRANCH="python-original"
TOKEN="${GITHUB_TOKEN:-${GITHUB_PAT:-}}"
BOOKS_DIR="docs/books"
GDD_DIR="docs/gdd_examples"

if [ -z "$TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN environment variable not set."
  echo "Usage: GITHUB_TOKEN=your_token bash scripts/ontology/download-books.sh"
  exit 1
fi

# Book list from BOOKS_REGISTRY
BOOKS=(
  "Schell_Geymdizayn.pdf"
  "Iskusstvo_Geymdizayna.pdf"
  "Game_Mechanics_Advanced_Game_Design.pdf"
  "Bri_Destins_Dumai_kak_geym_dizainer_2024.pdf"
  "Michael_Sellers_Advanced_Game_Design.pdf"
  "Schreiber_Rogers_Game_Balance.pdf"
  "SW_BAND.pdf"
  "Zubek_Elementy_geymdizayna_2022.pdf"
  "Gazendasek_Vseadnye_dizainery_igr_2023.pdf"
  "Kadikov_Proektirovanie_virtualnyh_mirov_2019.pdf"
  "Kniga_Igroka_2024.pdf"
  "Igrovoy_balans_nauka.pdf"
  "LD_In_pursuit_of_better_levels.pdf"
  "Rollingz_Morris_Proektirovanie_i_arkhitektura_igr.pdf"
  "Scott_Rogers_Level_Up.pdf"
  "Tracy_Fullerton_Game_Design_Workshop_2024.pdf"
  "Bond_Unity_i_Cs_2019.pdf"
)

mkdir -p "$BOOKS_DIR"

echo "============================================"
echo "Downloading ${#BOOKS[@]} books from $BRANCH"
echo "============================================"

SUCCESS=0
FAIL=0

for BOOK in "${BOOKS[@]}"; do
  OUTPUT="$BOOKS_DIR/$BOOK"
  if [ -f "$OUTPUT" ]; then
    echo "  [SKIP] $BOOK (already exists)"
    SUCCESS=$((SUCCESS+1))
    continue
  fi

  echo -n "  [DOWN] $BOOK ... "
  HTTP_CODE=$(curl -sL -w "%{http_code}" \
    -H "Authorization: token $TOKEN" \
    "https://github.com/$REPO/raw/$BRANCH/$BOOKS_DIR/$BOOK" \
    -o "$OUTPUT" 2>/dev/null)

  if [ "$HTTP_CODE" = "200" ] && [ -s "$OUTPUT" ]; then
    SIZE=$(du -h "$OUTPUT" | cut -f1)
    echo "OK ($SIZE)"
    SUCCESS=$((SUCCESS+1))
  else
    echo "FAIL (HTTP $HTTP_CODE)"
    rm -f "$OUTPUT"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "============================================"
echo "Download complete: $SUCCESS success, $FAIL fail"
echo "============================================"
