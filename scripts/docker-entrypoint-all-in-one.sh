#!/bin/bash
# =============================================================================
# Gidede — Docker Entrypoint (All-in-One Container)
# =============================================================================
# Инициализирует PostgreSQL, Redis, запускает миграции Alembic,
# затем передаёт управление supervisord.
#
# Поддержка команды "test":
#   docker compose -f docker-compose.single.yml run --rm gidede test [backend|frontend|lint|coverage]
# =============================================================================

set -e

# Проверяем, запущен ли режим тестирования
if [ "${1}" = "test" ]; then
    shift  # убираем "test" из аргументов
    exec /app/docker-run-tests.sh "$@"
fi

echo "============================================"
echo "  Gidede All-in-One — Starting Up"
echo "============================================"

# --- 1. Инициализация PostgreSQL ---
echo "[1/5] Initializing PostgreSQL..."

# Если данные ещё не инициализированы
if [ ! -d /var/lib/postgresql/16/main/base ]; then
    echo "  Creating PostgreSQL cluster..."
    su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/lib/postgresql/16/main" 2>/dev/null || true

    # Настройка доступа
    echo "local all all trust" > /etc/postgresql/16/main/pg_hba.conf
    echo "host all all 127.0.0.1/32 trust" >> /etc/postgresql/16/main/pg_hba.conf
    echo "host all all ::1/128 trust" >> /etc/postgresql/16/main/pg_hba.conf

    # Включаем pgvector
    echo "shared_preload_libraries = 'vector'" >> /etc/postgresql/16/main/postgresql.conf
fi

# Запускаем PostgreSQL временно для настройки
echo "  Starting PostgreSQL temporarily..."
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl start -D /var/lib/postgresql/16/main -w -o '-c listen_addresses=127.0.0.1'" 2>/dev/null || true

# Ждём готовности
echo "  Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    if su postgres -c "pg_isready -h 127.0.0.1 -p 5432" 2>/dev/null; then
        echo "  PostgreSQL is ready!"
        break
    fi
    sleep 1
done

# Создаём базу и пользователя если нет
echo "  Creating database and user..."
su postgres -c "psql -h 127.0.0.1 -c \"SELECT 1 FROM pg_roles WHERE rolname='gidede'\"" 2>/dev/null | grep -q 1 || \
    su postgres -c "psql -h 127.0.0.1 -c \"CREATE USER gidede WITH PASSWORD 'gidede_allinone' SUPERUSER;\"" 2>/dev/null || true

su postgres -c "psql -h 127.0.0.1 -lqt" 2>/dev/null | cut -d \| -f 1 | grep -qw gidede || \
    su postgres -c "psql -h 127.0.0.1 -c \"CREATE DATABASE gidede OWNER gidede;\"" 2>/dev/null || true

# Включаем расширение pgvector
su postgres -c "psql -h 127.0.0.1 -d gidede -c \"CREATE EXTENSION IF NOT EXISTS vector;\"" 2>/dev/null || true

# Останавливаем временный PostgreSQL (supervisord запустит его заново)
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl stop -D /var/lib/postgresql/16/main -m fast" 2>/dev/null || true

echo "  PostgreSQL initialization complete."

# --- 2. Запуск Redis временно для проверки ---
echo "[2/5] Starting Redis temporarily..."
redis-server --daemonize yes --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru

# Проверка
for i in $(seq 1 10); do
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "  Redis is ready!"
        break
    fi
    sleep 1
done

# Останавливаем (supervisord запустит заново)
redis-cli shutdown 2>/dev/null || true

echo "  Redis initialization complete."

# --- 3. Запуск Alembic миграций ---
echo "[3/5] Running database migrations..."

# Запускаем PostgreSQL через supervisord (только postgres)
/usr/local/bin/supervisord -c /etc/supervisor/conf.d/gidede.conf -s http://localhost:9001 &
SUPERVISOR_PID=$!

# Ждём PostgreSQL
for i in $(seq 1 30); do
    if su postgres -c "pg_isready -h 127.0.0.1 -p 5432" 2>/dev/null; then
        break
    fi
    sleep 1
done

# Ждём Redis
for i in $(seq 1 15); do
    if redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then
        break
    fi
    sleep 1
done

# Запускаем миграции
cd /app/backend
if [ -d "alembic" ]; then
    echo "  Running Alembic migrations..."
    alembic upgrade head 2>&1 || echo "  WARNING: Alembic migration failed (may need manual fix)"
else
    echo "  No Alembic directory found, skipping migrations."
fi

echo "  Migrations complete."

# --- 4. Останавливаем временный supervisord ---
echo "[4/5] Restarting all services..."
kill $SUPERVISOR_PID 2>/dev/null || true
sleep 2

# --- 5. Запускаем всё через supervisord ---
echo "[5/5] Starting Gidede (supervisord)..."
echo ""
echo "============================================"
echo "  Gidede is starting!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3030"
echo "  API Docs: http://localhost:3030/docs"
echo "============================================"
echo ""

exec /usr/local/bin/supervisord -c /etc/supervisor/conf.d/gidede.conf
