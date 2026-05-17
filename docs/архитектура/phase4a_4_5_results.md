# Фаза 4.A: Результаты задач 4.A.4–4.A.5

> **Дата**: 2026-05-18  
> **Субфаза**: 4.A — Инфраструктура и фундамент  
> **Статус**: 4.A.4 ✅ | 4.A.5 ✅

---

## 4.A.4 — Проектирование и реализация схемы PostgreSQL (Project State)

**Статус**: ✅ Завершена

### Архитектура данных

Схема БД реализует модель Project State из спецификации 3.10 (Этап 3). Основной принцип — **реляционные поля для индексации + JSON-поля для гибкости**. Это позволяет быстро фильтровать и искать проекты по жанру, эстетике, статусу, но при этом хранить сложные вложенные структуры (OnePager, CoreLoopProfile и т.д.) без необходимости создавать десятки таблиц.

### Диаграмма связей

```
users (1) ──── (N) projects
  │                    │
  │                    ├── (1:1) project_concepts       (Блок 1)
  │                    ├── (1:1) project_core_loops     (Блок 2)
  │                    ├── (1:1) project_mda_profiles   (Блок 3)
  │                    ├── (1:1) project_balance_results (Блок 4)
  │                    ├── (1:1) project_progressions   (Блок 5)
  │                    ├── (1:1) project_economies      (Блок 5)
  │                    ├── (1:1) project_gdds           (Блок 6)
  │                    └── (1:1) project_checklists     (Блок 6)
  │
  └── (1:N) refresh_tokens

mechanics_db (статическая справочная таблица, 127 механик)
prompt_logs (логирование AI-вызовов)
```

### Таблицы (11 основных + 2 вспомогательные)

| # | Таблица | Назначение | Ключевые индексы | Блок |
|---|---------|-----------|-------------------|------|
| 1 | `users` | Пользователи системы | email (unique), plan | — |
| 2 | `refresh_tokens` | JWT refresh-токены | token (unique), user_id | — |
| 3 | `projects` | Проекты (Project State) | user_id, genre, status, project_stage | SSOT |
| 4 | `project_concepts` | OnePager + эстетика + механики | project_id (unique), genre, primary_aesthetic | 1 |
| 5 | `project_core_loops` | Core Loop Profile + патологии | project_id (unique), structural_type | 2 |
| 6 | `project_mda_profiles` | MDA Profile + линзы + Бонд | project_id (unique), primary_aesthetic | 3 |
| 7 | `project_balance_results` | Баланс + симуляции | project_id (unique), balance_type | 4 |
| 8 | `project_progressions` | Кривые прогрессии + контент-план | project_id (unique), curve_type | 5 |
| 9 | `project_economies` | Machinations + ресурсы | project_id (unique), system_type | 5 |
| 10 | `project_gdds` | GDD секции + визуал | project_id (unique), format | 6 |
| 11 | `project_checklists` | Валидация + чек-листы | project_id (unique), readiness_level | 6 |
| — | `mechanics_db` | Справочник 127 механик | group_name | static |
| — | `prompt_logs` | Логи AI-промптов | prompt_id, user_id, created_at | logging |

### Стратегия хранения JSON

Каждая таблица блоков имеет два типа колонок:

**Реляционные поля (для индексации и быстрого поиска):**
- `genre`, `primary_aesthetic`, `structural_type`, `balance_type`, `system_type`, `format`, `readiness_level` — строковые поля с индексами
- `overall_match`, `overall_balance_score`, `overall_score` — числовые поля для сортировки
- `step_count`, `total_levels`, `element_count` — числовые поля для агрегации

**JSON-поля (для полных данных из алгоритмов):**
- `one_pager_data`, `aesthetic_profile`, `mechanic_set` — полные структуры из алгоритмов 3.1–3.8
- `full_profile` / `full_result` — полный профиль блока для быстрого извлечения

### Артефакты

| Файл | Описание |
|------|----------|
| `mini-services/api-service/app/core/database.py` | Подключение к БД (SQLAlchemy async, PostgreSQL/SQLite) |
| `mini-services/api-service/app/models/db.py` | 13 ORM-моделей SQLAlchemy (все таблицы) |
| `mini-services/api-service/app/models/__init__.py` | Экспорт моделей |
| `mini-services/api-service/alembic/` | Настройка Alembic (env.py для async) |
| `mini-services/api-service/alembic/versions/8500d29c55e0_initial_project_state_schema.py` | Первая миграция (создание всех таблиц) |
| `prisma/schema.prisma` | Обновлённая Prisma-схема (совместима с SQLAlchemy) |

### Переменные окружения

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./gidede_dev.db` | URL базы данных |
| `POSTGRES_URL` | `postgresql://gidede:gidede_dev@localhost:5432/gidede` | PostgreSQL URL (через Docker) |
| `SQL_ECHO` | `false` | Логирование SQL-запросов |

---

## 4.A.5 — Реализация авторизации и управления пользователями

**Статус**: ✅ Завершена

### Архитектура авторизации

Реализована JWT-авторизация с access + refresh токенами. Access token используется для авторизации API-запросов, refresh token — для получения нового access token без повторного ввода пароля.

```
┌─────────────────────────────────────────────────────────┐
│                     КЛИЕНТ (Next.js)                     │
│                                                          │
│  AuthProvider (React Context)                            │
│    ├── useAuth() → { user, login, register, logout }     │
│    ├── localStorage: access_token + refresh_token        │
│    ├── apiFetch() — auto-add Authorization header        │
│    └── Auto-refresh on 401 → retry with new token        │
│                                                          │
│  Страницы:                                               │
│    ├── /login — форма логина                             │
│    └── /register — форма регистрации                     │
└──────────────────────────┬──────────────────────────────┘
                           │
                    HTTP REST API
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   СЕРВЕР (FastAPI)                        │
│                                                          │
│  /api/v1/auth/register → User + JWT tokens               │
│  /api/v1/auth/login    → User + JWT tokens               │
│  /api/v1/auth/refresh  → New JWT tokens (rotation)       │
│  /api/v1/auth/me       → Current user info               │
│  /api/v1/auth/logout   → Revoke refresh token            │
│  /api/v1/auth/change-password → Update password          │
│                                                          │
│  Middleware:                                              │
│    get_current_user → JWT validation + DB lookup          │
│    require_plan("pro") → Plan-based access control        │
│                                                          │
│  Security:                                                │
│    bcrypt (12 rounds) for password hashing                │
│    JWT HS256 with configurable secret                     │
│    Refresh token rotation (old token revoked on refresh)  │
│    Token stored in DB with is_revoked flag                │
└──────────────────────────────────────────────────────────┘
```

### Уровни доступа

| План | AI-лимит (день) | Доступные функции |
|------|-----------------|-------------------|
| `free` | 50 | Базовые функции всех блоков, ограниченные AI-вызовы |
| `pro` | 500 | Все функции, увеличенные AI-лимиты, приоритетная обработка |

### Безопасность

1. **Пароли**: bcrypt с 12 rounds — устойчивость к brute-force
2. **Access Token**: HS256, 30 минут жизни — короткое окно компрометации
3. **Refresh Token**: 7 дней жизни, ротация при обновлении — старый токен аннулируется
4. **Хранение**: Refresh token в БД с флагом `is_revoked` — возможность принудительного разлогина
5. **CORS**: Только localhost:3000 для локальной разработки
6. **Валидация**: Pydantic-схемы для всех входных данных

### API-эндпоинты

| Метод | Путь | Описание | Авторизация |
|-------|------|----------|-------------|
| POST | `/api/v1/auth/register` | Регистрация нового пользователя | Нет |
| POST | `/api/v1/auth/login` | Авторизация | Нет |
| POST | `/api/v1/auth/refresh` | Обновление токенов | Нет |
| GET | `/api/v1/auth/me` | Данные текущего пользователя | Bearer |
| PUT | `/api/v1/auth/me` | Обновление профиля | Bearer |
| POST | `/api/v1/auth/logout` | Выход (отзыв refresh token) | Bearer |
| POST | `/api/v1/auth/change-password` | Смена пароля | Bearer |

### Frontend-компоненты

| Файл | Описание |
|------|----------|
| `src/lib/auth.tsx` | AuthProvider + useAuth() hook + apiFetch() helper |
| `src/app/login/page.tsx` | Страница логина (email + password) |
| `src/app/register/page.tsx` | Страница регистрации (email + password + name) |
| `src/components/gidede/layout-shell.tsx` | Условный рендеринг sidebar (скрыт на /login, /register) |
| `src/components/gidede/sidebar.tsx` | Обновлён: инфо пользователя, план, кнопка входа/выхода |
| `src/app/layout.tsx` | Обновлён: обёрнут в AuthProvider |

### Артефакты Backend

| Файл | Описание |
|------|----------|
| `app/core/security.py` | JWT создание/валидация, bcrypt хеширование, управление refresh tokens |
| `app/core/auth_middleware.py` | FastAPI dependencies: get_current_user, require_plan |
| `app/api/v1/auth.py` | 7 API-эндпоинтов авторизации |
| `app/schemas/auth.py` | Pydantic-схемы: UserRegister, UserLogin, TokenResponse и др. |
| `app/schemas/project.py` | Pydantic-схемы: ProjectCreate, ProjectUpdate, ProjectResponse |
| `app/core/config.py` | Обновлён: JWT_SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES и др. |
| `main.py` | Обновлён: lifespan с init_db/close_db, auth_router |

### Переменные окружения

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `JWT_SECRET_KEY` | `gidede_dev_secret_key_change_in_production_2026` | Секретный ключ JWT (**обязательно сменить в production!**) |
| `JWT_ALGORITHM` | `HS256` | Алгоритм подписи JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Время жизни access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Время жизни refresh token |
| `FREE_AI_CALLS_LIMIT` | `50` | Лимит AI-вызовов для free плана |
| `PRO_AI_CALLS_LIMIT` | `500` | Лимит AI-вызовов для pro плана |

---

## Следующие задачи (4.A.6–4.A.12)

| Задача | Описание | Зависимости | Сложность |
|--------|----------|-------------|-----------|
| 4.A.6 | CRUD для проектов | 4.A.4, 4.A.5 | M |
| 4.A.7 | AI-сервис (PromptExecutor) | 4.A.3, 4.A.4 | XL |
| 4.A.8 | Реестр промптов | 4.A.7 | L |
| 4.A.9 | Redis: кэш, сессии, Pub/Sub | 4.A.3 | M |
| 4.A.10 | pgvector + RAG | 4.A.4, 4.A.7 | L |
| 4.A.11 | CI/CD + линтеры | 4.A.1–4.A.3 | S |
| 4.A.12 | Shared-модели | 4.A.2, 4.A.3 | M |
