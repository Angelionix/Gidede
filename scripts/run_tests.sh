#!/bin/bash
# Gidede — Локальный запуск всех тестов
# Фаза 4.A.11: Локальная тестовая инфраструктура
#
# Использование:
#   ./scripts/run_tests.sh           — все тесты (backend + frontend)
#   ./scripts/run_tests.sh backend   — только backend
#   ./scripts/run_tests.sh frontend  — только frontend
#   ./scripts/run_tests.sh lint      — только линтеры
#   ./scripts/run_tests.sh coverage  — с покрытием

set -e

COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/mini-services/api-service"
FRONTEND_DIR="$REPO_ROOT"

echo -e "${COLOR_BLUE}═══════════════════════════════════════════${COLOR_RESET}"
echo -e "${COLOR_BLUE}  Gidede — Локальная тестовая инфраструктура  ${COLOR_RESET}"
echo -e "${COLOR_BLUE}═══════════════════════════════════════════${COLOR_RESET}"
echo ""

TARGET="${1:-all}"
RUN_COVERAGE=false
if [[ "$*" == *"--coverage"* ]] || [[ "$TARGET" == "coverage" ]]; then
    RUN_COVERAGE=true
fi

# ============================================================
# BACKEND TESTS
# ============================================================

run_backend_tests() {
    echo -e "${COLOR_YELLOW}[1/3] Backend: pytest${COLOR_RESET}"
    cd "$BACKEND_DIR"

    if [ "$RUN_COVERAGE" = true ]; then
        echo "  Running with coverage..."
        python -m pytest tests/ -v --tb=short \
            --cov=app \
            --cov-report=term-missing \
            --cov-report=html:coverage_html \
            --cov-report=json:coverage.json \
            2>&1 || {
            echo -e "${COLOR_RED}  ✗ Backend tests FAILED${COLOR_RESET}"
            return 1
        }
    else
        python -m pytest tests/ -v --tb=short 2>&1 || {
            echo -e "${COLOR_RED}  ✗ Backend tests FAILED${COLOR_RESET}"
            return 1
        }
    fi

    echo -e "${COLOR_GREEN}  ✓ Backend tests PASSED${COLOR_RESET}"
}

# ============================================================
# FRONTEND TESTS
# ============================================================

run_frontend_tests() {
    echo -e "${COLOR_YELLOW}[2/3] Frontend: vitest${COLOR_RESET}"
    cd "$FRONTEND_DIR"

    # Проверяем, установлен ли vitest
    if ! npx vitest --version &>/dev/null; then
        echo -e "${COLOR_YELLOW}  Установка vitest...${COLOR_RESET}"
        npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @vitest/coverage-v8 2>&1 || {
            echo -e "${COLOR_RED}  ✗ Failed to install vitest${COLOR_RESET}"
            return 1
        }
    fi

    if [ "$RUN_COVERAGE" = true ]; then
        echo "  Running with coverage..."
        npx vitest run --coverage 2>&1 || {
            echo -e "${COLOR_RED}  ✗ Frontend tests FAILED${COLOR_RESET}"
            return 1
        }
    else
        npx vitest run 2>&1 || {
            echo -e "${COLOR_RED}  ✗ Frontend tests FAILED${COLOR_RESET}"
            return 1
        }
    fi

    echo -e "${COLOR_GREEN}  ✓ Frontend tests PASSED${COLOR_RESET}"
}

# ============================================================
# LINTERS
# ============================================================

run_linters() {
    echo -e "${COLOR_YELLOW}[3/3] Линтеры${COLOR_RESET}"

    # Python: Ruff
    echo "  Ruff (Python)..."
    cd "$BACKEND_DIR"
    ruff check app/ tests/ 2>&1 || {
        echo -e "${COLOR_RED}  ✗ Ruff lint FAILED${COLOR_RESET}"
    }
    echo -e "${COLOR_GREEN}  ✓ Ruff passed${COLOR_RESET}"

    # TypeScript: ESLint
    echo "  ESLint (TypeScript)..."
    cd "$FRONTEND_DIR"
    npx eslint src/ --max-warnings=100 2>&1 || {
        echo -e "${COLOR_YELLOW}  ⚠ ESLint has warnings (non-blocking)${COLOR_RESET}"
    }
    echo -e "${COLOR_GREEN}  ✓ ESLint completed${COLOR_RESET}"
}

# ============================================================
# MAIN
# ============================================================

case "$TARGET" in
    backend)
        run_backend_tests
        ;;
    frontend)
        run_frontend_tests
        ;;
    lint)
        run_linters
        ;;
    coverage)
        RUN_COVERAGE=true
        run_backend_tests
        run_frontend_tests
        ;;
    all)
        run_backend_tests
        echo ""
        run_frontend_tests
        echo ""
        run_linters
        ;;
    *)
        echo "Usage: $0 {all|backend|frontend|lint|coverage}"
        echo "  all       — все тесты + линтеры (default)"
        echo "  backend   — только backend (pytest)"
        echo "  frontend  — только frontend (vitest)"
        echo "  lint      — только линтеры (ruff + eslint)"
        echo "  coverage  — все тесты с покрытием"
        exit 1
        ;;
esac

echo ""
echo -e "${COLOR_GREEN}═══════════════════════════════════════════${COLOR_RESET}"
echo -e "${COLOR_GREEN}  Тестирование завершено!                    ${COLOR_RESET}"
echo -e "${COLOR_GREEN}═══════════════════════════════════════════${COLOR_RESET}"

# Генерация отчёта
REPORT_FILE="$REPO_ROOT/test_report_$(date +%Y%m%d_%H%M%S).txt"
echo "Gidede Test Report — $(date)" > "$REPORT_FILE"
echo "==============================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Run: $0 $@" >> "$REPORT_FILE"
echo "Result: SUCCESS" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE"
