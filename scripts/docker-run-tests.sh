#!/bin/bash
# =============================================================================
# Gidede — Docker Test Runner (All-in-One Container)
# =============================================================================
# Запускается внутри Docker-контейнера. Поднимает PG+Redis, прогоняет тесты.
#
# Использование (с хоста):
#   docker compose -f docker-compose.single.yml run --rm gidede test
#   docker compose -f docker-compose.single.yml run --rm gidede test backend
#   docker compose -f docker-compose.single.yml run --rm gidede test frontend
#   docker compose -f docker-compose.single.yml run --rm gidede test lint
#   docker compose -f docker-compose.single.yml run --rm gidede test coverage
# =============================================================================

set -e

COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[0;33m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

TARGET="${1:-all}"
RUN_COVERAGE=false
if [[ "$*" == *"--coverage"* ]] || [[ "$TARGET" == "coverage" ]]; then
    RUN_COVERAGE=true
fi

echo -e "${COLOR_BLUE}══════════════════════════════════════════════${COLOR_RESET}"
echo -e "${COLOR_BLUE}  Gidede — Docker Test Runner (All-in-One)     ${COLOR_RESET}"
echo -e "${COLOR_BLUE}══════════════════════════════════════════════${COLOR_RESET}"
echo ""

# ============================================================
# Запуск PostgreSQL и Redis (для интеграционных тестов)
# ============================================================

start_services() {
    echo -e "${COLOR_YELLOW}[0/4] Starting PostgreSQL and Redis...${COLOR_RESET}"

    # Инициализация PostgreSQL при первом запуске
    if [ ! -d /var/lib/postgresql/16/main/base ]; then
        echo "  Initializing PostgreSQL cluster..."
        su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/lib/postgresql/16/main" 2>/dev/null || true

        echo "local all all trust" > /etc/postgresql/16/main/pg_hba.conf
        echo "host all all 127.0.0.1/32 trust" >> /etc/postgresql/16/main/pg_hba.conf
        echo "host all all ::1/128 trust" >> /etc/postgresql/16/main/pg_hba.conf
        echo "shared_preload_libraries = 'vector'" >> /etc/postgresql/16/main/postgresql.conf
    fi

    # Запуск PostgreSQL
    su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl start -D /var/lib/postgresql/16/main -w -o '-c listen_addresses=127.0.0.1'" 2>/dev/null || true

    # Ждём готовности PostgreSQL
    for i in $(seq 1 30); do
        if su postgres -c "pg_isready -h 127.0.0.1 -p 5432" 2>/dev/null; then
            echo "  PostgreSQL is ready!"
            break
        fi
        sleep 1
    done

    # Создаём базу и пользователя
    su postgres -c "psql -h 127.0.0.1 -c \"SELECT 1 FROM pg_roles WHERE rolname='gidede'\"" 2>/dev/null | grep -q 1 || \
        su postgres -c "psql -h 127.0.0.1 -c \"CREATE USER gidede WITH PASSWORD 'gidede_allinone' SUPERUSER;\"" 2>/dev/null || true

    su postgres -c "psql -h 127.0.0.1 -lqt" 2>/dev/null | cut -d \| -f 1 | grep -qw gidede || \
        su postgres -c "psql -h 127.0.0.1 -c \"CREATE DATABASE gidede OWNER gidede;\"" 2>/dev/null || true

    su postgres -c "psql -h 127.0.0.1 -d gidede -c \"CREATE EXTENSION IF NOT EXISTS vector;\"" 2>/dev/null || true

    # Запуск Redis
    redis-server --daemonize yes --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru

    for i in $(seq 1 10); do
        if redis-cli ping 2>/dev/null | grep -q PONG; then
            echo "  Redis is ready!"
            break
        fi
        sleep 1
    done

    # Запуск Alembic миграций
    echo "  Running Alembic migrations..."
    cd /app/backend
    if [ -d "alembic" ]; then
        alembic upgrade head 2>&1 || echo "  WARNING: Alembic migration failed"
    fi

    echo -e "${COLOR_GREEN}  Services started successfully!${COLOR_RESET}"
    echo ""
}

stop_services() {
    echo ""
    echo -e "${COLOR_YELLOW}Stopping services...${COLOR_RESET}"
    su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl stop -D /var/lib/postgresql/16/main -m fast" 2>/dev/null || true
    redis-cli shutdown 2>/dev/null || true
    echo -e "${COLOR_GREEN}  Services stopped.${COLOR_RESET}"
}

# ============================================================
# BACKEND TESTS
# ============================================================

run_backend_tests() {
    echo -e "${COLOR_YELLOW}[1/3] Backend: pytest${COLOR_RESET}"
    cd /app/backend

    if [ "$RUN_COVERAGE" = true ]; then
        echo "  Running with coverage..."
        python -m pytest tests/ -v --tb=short \
            --cov=app \
            --cov-report=term-missing \
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
    cd /app/frontend-src

    # Убеждаемся, что зависимости доступны
    if [ ! -d "node_modules/.bin" ]; then
        echo "  Installing frontend test dependencies..."
        bun install 2>&1 || {
            echo -e "${COLOR_RED}  ✗ Failed to install frontend deps${COLOR_RESET}"
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
    cd /app/backend
    ruff check app/ tests/ 2>&1 || {
        echo -e "${COLOR_YELLOW}  ⚠ Ruff lint has issues${COLOR_RESET}"
    }
    echo -e "${COLOR_GREEN}  ✓ Ruff completed${COLOR_RESET}"

    # TypeScript: ESLint
    echo "  ESLint (TypeScript)..."
    cd /app/frontend-src
    npx eslint src/ --max-warnings=100 2>&1 || {
        echo -e "${COLOR_YELLOW}  ⚠ ESLint has warnings (non-blocking)${COLOR_RESET}"
    }
    echo -e "${COLOR_GREEN}  ✓ ESLint completed${COLOR_RESET}"
}

# ============================================================
# MAIN
# ============================================================

# Запускаем сервисы для всех типов тестов, кроме lint
if [[ "$TARGET" != "lint" ]]; then
    start_services
fi

EXIT_CODE=0

case "$TARGET" in
    backend)
        run_backend_tests || EXIT_CODE=1
        ;;
    frontend)
        run_frontend_tests || EXIT_CODE=1
        ;;
    lint)
        run_linters || EXIT_CODE=1
        ;;
    coverage)
        RUN_COVERAGE=true
        run_backend_tests || EXIT_CODE=1
        echo ""
        run_frontend_tests || EXIT_CODE=1
        ;;
    all)
        run_backend_tests || EXIT_CODE=1
        echo ""
        run_frontend_tests || EXIT_CODE=1
        echo ""
        run_linters || EXIT_CODE=1
        ;;
    *)
        echo "Usage: docker-run-tests.sh {all|backend|frontend|lint|coverage}"
        echo "  all       — все тесты + линтеры (default)"
        echo "  backend   — только backend (pytest)"
        echo "  frontend  — только frontend (vitest)"
        echo "  lint      — только линтеры (ruff + eslint)"
        echo "  coverage  — все тесты с покрытием"
        EXIT_CODE=1
        ;;
esac

# Останавливаем сервисы
if [[ "$TARGET" != "lint" ]]; then
    stop_services
fi

echo ""
echo -e "${COLOR_GREEN}══════════════════════════════════════════════${COLOR_RESET}"
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${COLOR_GREEN}  Тестирование завершено: ВСЕ ТЕСТЫ ПРОЙДЕНЫ ✓   ${COLOR_RESET}"
else
    echo -e "${COLOR_RED}  Тестирование завершено: ЕСТЬ ОШИБКИ ✗          ${COLOR_RESET}"
fi
echo -e "${COLOR_GREEN}══════════════════════════════════════════════${COLOR_RESET}"

exit $EXIT_CODE
