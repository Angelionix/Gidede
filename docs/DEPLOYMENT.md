# Gidede — Deployment Guide

## Обзор

Gidede — это Game Design AI System на Next.js 16 с TypeScript, Prisma (SQLite) и z-ai-web-dev-sdk для AI.
Не требует внешних баз данных — всё работает в одном процессе.

**Порт по умолчанию:** 3000
**База данных:** SQLite (файл в `db/custom.db`)
**AI:** z-ai-web-dev-sdk (встроен, не требует API ключей)

---

## Вариант 1: Локальный запуск (Development)

### Требования
- Node.js 20+ или Bun 1.0+
- 512MB RAM минимум

### Шаги

```bash
# 1. Клонировать репозиторий
git clone https://github.com/Angelionix/Gidede.git
cd Gidede
git checkout nextjs-port  # или main после merge

# 2. Установить зависимости
bun install  # или npm install

# 3. Настроить окружение
cp .env.example .env
# Отредактируйте .env при необходимости

# 4. Инициализировать БД
bun run db:push

# 5. Запустить dev-сервер
bun run dev

# 6. Открыть http://localhost:3000
```

### Переменные окружения (.env)

```env
DATABASE_URL="file:./db/custom.db"
JWT_SECRET_KEY="your-secret-key-here"  # обязателен в production
NEXT_PUBLIC_API_URL=""                 # пусто = относительные пути
ZAI_API_KEY=""                         # опционально, AI работает и без него
```

---

## Вариант 2: Docker (рекомендуется для production)

### Требования
- Docker 20+
- Docker Compose 2+

### Быстрый старт

```bash
# 1. Клонировать
git clone https://github.com/Angelionix/Gidede.git
cd Gidede

# 2. Создать .env (опционально)
echo 'JWT_SECRET_KEY=your-production-secret-here' > .env

# 3. Собрать и запустить
docker compose up -d --build

# 4. Проверить
curl http://localhost:3000/api/v1/health
# Ожидаемый ответ: {"status":"healthy","service":"gidede-api",...}

# 5. Логи
docker compose logs -f

# 6. Остановить
docker compose down
```

### Управление данными

```bash
# БД хранится в ./db/custom.db (volume mount)
# Бэкап:
cp db/custom.db db/backup-$(date +%Y%m%d).db

# Восстановление:
docker compose down
cp db/backup-20260724.db db/custom.db
docker compose up -d
```

### Обновление

```bash
git pull
docker compose up -d --build
```

---

## Вариант 3: Bare Server (VPS/VM без Docker)

### Требования
- Ubuntu 22.04+ / Debian 12+
- Node.js 20+ (установка через nvm)
- 1GB RAM минимум (2GB рекомендуется)

### Установка

```bash
# 1. Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Установить Bun (опционально, но быстрее)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 3. Клонировать
cd /opt
sudo git clone https://github.com/Angelionix/Gidede.git
sudo chown -R $USER:$USER Gidede
cd Gidede

# 4. Установить зависимости
bun install

# 5. Настроить окружение
cp .env.example .env
nano .env  # установить JWT_SECRET_KEY

# 6. Инициализировать БД
bun run db:push

# 7. Сборка
bun run build

# 8. Запуск (тестовый)
bun run start
```

### systemd Service

```bash
# Создать service file
sudo tee /etc/systemd/system/gidede.service << 'EOF'
[Unit]
Description=Gidede Game Design AI System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/Gidede
ExecStart=/usr/bin/bun run start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=DATABASE_URL=file:/opt/Gidede/db/custom.db
EnvironmentFile=/opt/Gidede/.env

[Install]
WantedBy=multi-user.target
EOF

# Включить и запустить
sudo systemctl daemon-reload
sudo systemctl enable gidede
sudo systemctl start gidede

# Проверить статус
sudo systemctl status gidede

# Логи
sudo journalctl -u gidede -f
```

### Nginx Reverse Proxy

```bash
sudo tee /etc/nginx/sites-available/gidede << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/gidede /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL (опционально, через certbot)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Вариант 4: PM2 (альтернатива systemd)

```bash
# Установить PM2
npm install -g pm2

# Запуск
cd /opt/Gidede
pm2 start "bun run start" --name gidede

# Автозапуск
pm2 startup
pm2 save

# Логи
pm2 logs gidede

# Мониторинг
pm2 monit
```

---

## Health Check

```bash
# Проверка работоспособности
curl http://localhost:3000/api/v1/health

# Ожидаемый ответ:
# {"status":"healthy","service":"gidede-api","version":"0.51.0",...}
```

## Создание первого пользователя

```bash
# Регистрация через API
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"securepass123","name":"Admin"}'

# Логин
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"securepass123"}'
```

---

## Устранение проблем

### База данных не создаётся
```bash
# Удалить и пересоздать
rm db/custom.db
bun run db:push
```

### Ошибка "EADDRINUSE: address already in use :::3000"
```bash
# Найти процесс
lsof -i :3000
# Завершить
kill -9 <PID>
```

### AI не работает
- z-ai-web-dev-sdk работает без API ключей в этой среде
- Если AI недоступен, приложение использует детерминированный fallback (rules-engine)
- Проверьте логи: `grep "ai-service" dev.log`

### Сборка падает с OOM
```bash
# Увеличить лимит памяти Node.js
NODE_OPTIONS="--max-old-space-size=2048" bun run build
```
