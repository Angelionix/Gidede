# Руководство по вкладу в Gidede

Спасибо за интерес к проекту Gidede! Этот документ описывает правила и процессы контрибуции. Пожалуйста, ознакомьтесь с ним перед началом работы.

---

## 1. Как внести вклад

Мы приветствуем любой вклад в проект: исправление багов, новый функционал, улучшение документации, тесты. Общие правила:

- **Создайте Issue** перед началом работы — обсудите предлагаемое изменение с мейнтейнером, чтобы избежать дублирования усилий.
- **Один PR — одна задача**. Не объединяйте несвязанные изменения в одном Pull Request.
- **Следуйте правилам кода** (см. раздел 4) и формату коммитов (см. раздел 5).
- **Пишите тесты** для любого нового кода (см. раздел 7).
- **Обновляйте документацию**, если ваш PR затрагивает поведение системы.
- Будьте уважительны и конструктивны в обсуждениях.

---

## 2. Настройка окружения

### Клонирование репозитория

```bash
git clone https://github.com/Angelionix/Gidede.git
cd Gidede
```

### Установка зависимостей

**Frontend (Next.js):**

```bash
# Через npm
npm install

# Или через bun
bun install
```

**Backend (FastAPI):**

```bash
cd mini-services/api-service
pip install -r requirements.txt
```

### Docker Compose (PostgreSQL + Redis)

Для локальной разработки необходимы PostgreSQL 16 (с расширением pgvector) и Redis 7. Запустите их через Docker Compose:

```bash
docker compose up -d
```

Это поднимет:
- **PostgreSQL** на порту `5432` (пользователь: `gidede`, пароль: `gidede_dev`, БД: `gidede`)
- **Redis** на порту `6379`

Для мониторинга (Prometheus + Grafana):

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

### Переменные окружения

Скопируйте пример конфигурации и заполните необходимые значения:

```bash
cp .env.example .env
```

Обязательные переменные для локальной разработки:
- `DATABASE_URL` — строка подключения к PostgreSQL
- `REDIS_URL` — строка подключения к Redis
- `JWT_SECRET_KEY` — секрет для JWT (в dev можно оставить auto-generated)

Для работы AI-функций понадобится хотя бы один API-ключ:
- `ZAI_API_KEY` — основной провайдер (z.ai)
- `OPENAI_API_KEY` — fallback (OpenAI)
- `ANTHROPIC_API_KEY` — fallback (Anthropic)

### Миграции базы данных

```bash
# Prisma (frontend / SSR)
npm run db:generate
npm run db:push

# Alembic (backend)
cd mini-services/api-service
alembic upgrade head
```

### Запуск приложения

**Backend:**

```bash
cd mini-services/api-service
uvicorn main:app --port 3030 --reload
```

**Frontend:**

```bash
npm run dev
```

Приложение будет доступно:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3030
- API документация: http://localhost:3030/docs

### Запуск тестов

```bash
# Все тесты (через скрипт)
./scripts/run_tests.sh

# Backend (pytest)
cd mini-services/api-service
python -m pytest tests/ -v

# Backend с покрытием
python -m pytest tests/ -v --cov=app

# Frontend (vitest)
npx vitest run

# Frontend с покрытием
npx vitest run --coverage

# E2E (Playwright)
npx playwright test
```

---

## 3. Структура проекта

```
Gidede/
├── src/                        # Next.js 16 frontend
│   ├── app/                    # App Router: страницы и API-роуты
│   │   ├── blocks/1-8/         # 8 функциональных блоков
│   │   ├── projects/           # Управление проектами
│   │   ├── login/              # Авторизация
│   │   ├── register/           # Регистрация
│   │   └── settings/           # Настройки
│   ├── components/             # React-компоненты (shadcn/ui + gidede)
│   ├── hooks/                  # Кастомные React-хуки
│   ├── lib/                    # Утилиты, API-клиент, авторизация
│   ├── types/                  # TypeScript типы
│   ├── constants/              # Константы блоков
│   └── __tests__/              # Frontend тесты (vitest)
│
├── mini-services/
│   └── api-service/            # FastAPI backend
│       ├── app/
│       │   ├── ai/             # AI-сервис (PromptExecutor, Router, Cache, Providers)
│       │   ├── api/v1/         # REST API эндпоинты
│       │   ├── core/           # Конфигурация, БД, Redis, RAG, метрики
│       │   ├── data/           # MechanicsDB (128 механик)
│       │   ├── models/         # SQLAlchemy модели
│       │   ├── prompts/        # Реестр 34 промптов + A/B тестирование
│       │   ├── schemas/        # Pydantic-модели (запросы/ответы)
│       │   └── services/       # Бизнес-логика (12 сервисов)
│       ├── tests/              # Backend тесты (pytest)
│       ├── load_tests/         # Нагрузочные тесты (Locust)
│       └── alembic/            # Миграции БД
│
├── shared/                     # Общие типы (TypeScript + Python)
│   └── types/
│       ├── typescript/         # Интерфейсы и перечисления TS
│       └── python/             # Модели и перечисления Python
│
├── docs/                       # Документация
│   ├── анализ/                 # Анализ 17 книг по геймдизайну
│   ├── концепт/                # Концепция программы
│   ├── Алгоритмы/              # 10 алгоритмических спецификаций
│   ├── архитектура/            # Архитектурные документы
│   ├── тестирование/           # Тестовая документация
│   ├── bible/                  # Библия геймдизайна (12 разделов)
│   └── books/                  # Исходные PDF (17 книг)
│
├── e2e/                        # E2E тесты (Playwright)
├── scripts/                    # Скрипты (версионирование, тестирование)
├── prisma/                     # Prisma schema (SSR миграции)
├── monitoring/                 # Prometheus + Grafana конфигурация
├── VERSION                     # Единый источник версии
└── CHANGELOG.md                # История изменений
```

---

## 4. Правила кода

Мы следуем принципам **SOLID**, **KISS**, **DRY** и **YAGNI**. Код должен быть читаемым, поддерживаемым и тестируемым.

### Общие принципы

- **SOLID** — каждый класс/модуль имеет одну ответственность; расширение через интерфейсы, а не модификацию
- **KISS** — простые решения предпочтительнее сложных; избегайте преждевременной оптимизации
- **DRY** — не дублируйте логику; выделяйте общее в утилиты и shared-модули
- **YAGNI** — не реализуйте функционал «на будущее»; только то, что нужно сейчас

### TypeScript / React

- **Strict mode** включён: `strict: true` в `tsconfig.json`
- **`noImplicitAny`** — запрещены неявные `any`; все типы должны быть указаны явно
- **Без `@ts-ignore`** — если типы не сходятся, исправляйте типизацию, а не подавляйте ошибки
- Используйте **type guards** и **discriminated unions** для безопасной работы с вариантами
- **Компонентная модель**: каждый UI-компонент в отдельном файле; интерфейсы через props
- **`React.memo`** для тяжёлых компонентов, которые часто перерендериваются без изменения props
- Кастомные хуки — в `src/hooks/`, типы — в `src/types/`, константы — в `src/constants/`
- ESLint конфигурация обязательна к соблюдению: `npm run lint`

### Python

- **Type hints** обязательны для всех функций и методов
- **Ruff** для линтинга (конфигурация в `pyproject.toml`): `ruff check .`
- **Black** для форматирования: `black .`
- Pydantic-модели для всех API-схем (запросы/ответы)
- Сервисный слой: бизнес-логика в `app/services/`, API-эндпоинты — только маршрутизация и валидация
- Async/await для всех I/O-операций (БД, Redis, внешние API)

---

## 5. Коммиты

Проект использует **Conventional Commits**. Формат:

```
<type>(<scope>): <description>
```

### Типы коммитов

| Тип | Описание | Пример |
|-----|----------|--------|
| `feat` | Новый функционал | `feat(concept): add USP candidates generation` |
| `fix` | Исправление бага | `fix(balance): correct transitive analysis edge case` |
| `docs` | Документация | `docs(api): update OpenAPI schema examples` |
| `test` | Тесты | `test(coreloop): add validation panel tests` |
| `refactor` | Рефакторинг без изменения поведения | `refactor(ai): extract provider factory method` |
| `chore` | Обслуживание, зависимости, конфигурация | `chore(deps): update pytest to 8.2` |
| `perf` | Улучшение производительности | `perf(cache): add Redis caching for prompts` |
| `style` | Форматирование (без изменения логики) | `style(python): apply black formatting` |

### Правила

- Описание коммита — на английском, в повелительном наклонении: «add feature», «fix bug»
- **Scope** — модуль или компонент: `concept`, `coreloop`, `mda`, `balance`, `economy`, `gdd`, `ai`, `auth`, `api`, `ui`
- Длина строки — не более 100 символов
- Для breaking changes добавляйте `BREAKING CHANGE:` в footer

---

## 6. Ветвление

Проект использует упрощённый **Git Flow**:

```
main          — стабильная ветка, только через merge из develop
develop       — основная ветка разработки
feature/*     — новый функционал (от develop → в develop)
fix/*         — исправление багов (от develop → в develop)
hotfix/*      — срочные исправления (от main → в main + develop)
```

### Правила

- Ветвления именуются: `feature/краткое-описание`, `fix/краткое-описание`
- Примеры: `feature/progression-curves`, `fix/auth-token-refresh`
- Регулярно делайте rebase/merge из `develop`, чтобы избегать конфликтов
- Не коммитьте напрямую в `main` и `develop` — только через Pull Request

---

## 7. Тестирование

Тесты обязательны для любого нового кода. PR без тестов не принимается.

### Backend (pytest)

- Фреймворк: **pytest** с `pytest-asyncio`
- Расположение: `mini-services/api-service/tests/`
- Минимальное покрытие: **60%** для нового кода
- Запуск: `python -m pytest tests/ -v --cov=app`

```python
# Пример теста
async def test_generate_concept(client, mock_ai_executor):
    response = await client.post("/api/v1/concept/generate", json={...})
    assert response.status_code == 200
    data = response.json()
    assert "genre" in data
```

### Frontend (vitest)

- Фреймворк: **vitest** с `@testing-library/react`
- Расположение: `src/__tests__/`
- Минимальное покрытие: **50%** для нового кода
- Запуск: `npx vitest run --coverage`

```typescript
// Пример теста
describe("ConceptForm", () => {
  it("renders genre selector", () => {
    render(<ConceptForm />);
    expect(screen.getByLabelText(/жанр/i)).toBeInTheDocument();
  });
});
```

### E2E (Playwright)

- Фреймворк: **Playwright**
- Расположение: `e2e/`
- Покрытие: критические пользовательские сценарии
- Запуск: `npx playwright test`

Обязательные E2E-сценарии:
- Авторизация (логин, регистрация, выход)
- Пайплайн (создание проекта, прохождение блоков)
- Экспорт GDD
- AI-ассистент

---

## 8. Pull Request процесс

### Создание PR

1. Убедитесь, что ветка создана от `develop` и названа по правилам (см. раздел 6)
2. Убедитесь, что все тесты проходят:
   ```bash
   # Backend
   cd mini-services/api-service && python -m pytest tests/ -v

   # Frontend
   npx vitest run

   # E2E (для критических изменений)
   npx playwright test
   ```
3. Убедитесь, что линтеры не выдают ошибок:
   ```bash
   npm run lint           # Frontend ESLint
   ruff check .           # Backend Ruff
   ```
4. Заполните шаблон PR

### Чек-лист PR

- [ ] Код следует правилам проекта (SOLID/KISS/DRY/YAGNI)
- [ ] TypeScript: strict mode, нет `@ts-ignore`, нет `any`
- [ ] Python: type hints, Ruff и Black без замечаний
- [ ] Написаны тесты для нового кода (покрытие ≥ порога)
- [ ] Все существующие тесты проходят
- [ ] Документация обновлена (при необходимости)
- [ ] Коммиты соответствуют Conventional Commits
- [ ] Нет закоммиченных секретов, ключей, `.env` файлов
- [ ] PR содержит описание изменений и ссылку на Issue

### Ревью

- Минимум **1 одобрение** от мейнтейнера для слияния
- Срочные исправления (hotfix) могут быть слияны мейнтейнером самостоятельно
- Комментарии ревью должны быть разрешены до слияния
- После одобрения PR сливаётся через **Squash and Merge** (для чистой истории в `develop`)

---

## 9. Контакты

Если у вас есть вопросы, предложения или вы нашли баг:

- **GitHub Issues**: https://github.com/Angelionix/Gidede/issues
- **GitHub Discussions**: https://github.com/Angelionix/Gidede/discussions
- **Мейнтейнер**: @Angelionix

Для срочных вопросов по безопасности — используйте GitHub Issues с меткой `security`.

---

*Спасибо, что помогаете делать Gidede лучше!*
