# Gidede — Методология тестирования

## 0. Статус тестирования (после Фаз 1-6)

После завершения Фаз 1-6 роадмапа проект готов к автоматизированному тестированию:

- ✅ `typescript.ignoreBuildErrors` убран (Фаза 1.5) — `tsc --noEmit` проходит с 0 ошибок
- ✅ `bun run lint` — 0 ошибок
- ✅ Серверный пайплайн реальный (Фаза 1.7) — 8/8 стадий, 100% completion за ~1.2с
- ✅ Компилятор графа (Фаза 2) — все 20 нод, edge-traversal, 2D+3D
- ✅ Data-model hygiene (Фаза 4) — индексы, FK-каскады, soft-delete
- ✅ Node-редактор UX (Фаза 5) — undo/redo, snap-to-grid, HTML export

**Текущее покрытие**: ручное E2E через Agent Browser + curl. Автоматизированные unit/integration тесты (Vitest) — следующий шаг (Фаза 3 роадмапа).

## 1. Стратегия тестирования

### Уровни тестирования

| Уровень | Что проверяется | Инструмент | Покрытие |
|---------|----------------|------------|----------|
| Unit | Изолированные функции (api-helpers, mechanics-db, bible-rag, graph/compiler, graph/validator) | Vitest (планируется) | цель ≥60% |
| Integration | API endpoints (auth, concept, coreloop, prototypes, pipeline) | Vitest + supertest (планируется) | цель ≥50% |
| E2E | Критические пользовательские сценарии | Agent Browser | 100% golden path ✅ |
| Type-check | TypeScript-типы | `bunx tsc --noEmit` | 0 ошибок ✅ |
| Lint | Качество кода | `bun run lint` | 0 ошибок ✅ |
| Performance | Время ответа API, AI latency | curl + time | <2s API, <30s AI |
| Security | Auth, JWT, SQL injection, XSS | curl + ручные тесты | 100% auth flows |

---

## 2. Test Cases — Критические сценарии (Golden Path)

### TC-01: Регистрация нового пользователя
```http
POST /api/v1/auth/register
Body: {"email":"test@example.com","password":"password123","name":"Test User"}
Expected: 200, {access_token, refresh_token, user}
```

### TC-02: Логин существующего пользователя
```http
POST /api/v1/auth/login
Body: {"email":"test@example.com","password":"password123"}
Expected: 200, {access_token, refresh_token, user}
```

### TC-03: Получение профиля
```http
GET /api/v1/auth/me
Headers: Authorization: Bearer <token>
Expected: 200, {id, email, name, plan}
```

### TC-04: Создание проекта
```http
POST /api/v1/projects/
Headers: Authorization: Bearer <token>
Body: {"name":"Test RPG","description":"A fantasy RPG","genre":"RPG"}
Expected: 201, {id, name, status:"draft"}
```

### TC-05: Генерация концепции (Блок 1)
```http
POST /api/v1/concept/generate
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","idea":"A dark fantasy roguelike where you collect souls"}
Expected: 200, {genre, aesthetic_profile, mechanic_set, usp_candidates, core_loop_candidates}
```

### TC-06: Генерация концепции с AI
```http
POST /api/v1/concept/generate
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","idea":"A space exploration game","use_ai":true}
Expected: 200, generation_metadata.ai_enriched = true
```

### TC-07: Проектирование Core Loop (Блок 2)
```http
POST /api/v1/coreloop/design
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","mechanics":["explore","combat","reward"]}
Expected: 200, {structural_type, steps, pathologies, recommendations}
```

### TC-08: MDA-анализ (Блок 3)
```http
POST /api/v1/mda/analyze
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","target_aesthetics":["challenge","discovery"]}
Expected: 200, {mechanic_set, observed_dynamics, match_scores}
```

### TC-09: Анализ баланса (Блок 4)
```http
POST /api/v1/balance/analyze
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","elements":[{"name":"sword","cost":100,"power":50}]}
Expected: 200, {balance_type, overall_balance_score, pathologies}
```

### TC-10: Прогрессия (Блок 5)
```http
POST /api/v1/progression/design
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","total_levels":50}
Expected: 200, {macro_model, tier_model, curves}
```

### TC-11: Экономика (Блок 5)
```http
POST /api/v1/economy/design
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>"}
Expected: 200, {system_type, resource_model, conversion_chains}
```

### TC-12: Генерация GDD (Блок 6)
```http
POST /api/v1/gdd/generate
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","format":"one_sheet"}
Expected: 200, {sections, completeness_report}
```

### TC-13: Экспорт GDD в DOCX
```http
POST /api/v1/gdd/export
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","format":"docx"}
Expected: 200, {content (base64), filename:"...docx", mime_type}
```

### TC-14: AI-ассистент — чат
```http
POST /api/v1/assistant/chat
Headers: Authorization: Bearer <token>
Body: {"message":"Что такое MDA framework?"}
Expected: 200, {response, model_used:"glm-4.6" or "gidede-rules-v1"}
```

### TC-15: AI-ассистент — SSE стриминг
```http
POST /api/v1/assistant/chat/stream
Headers: Authorization: Bearer <token>
Body: {"message":"Объясни Triangle of Weirdness"}
Expected: 200, Content-Type: text/event-stream, multiple data chunks
```

### TC-16: RAG поиск по Библии
```http
POST /api/v1/rag/search
Headers: Authorization: Bearer <token>
Body: {"query":"core loop","top_k":5}
Expected: 200, {results: [...], stats: {bible_sections:12, bible_chunks:494}}
```

### TC-17: Генерация прототипа 2D
```http
POST /api/v1/prototypes/generate
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","mode":"2d","type":"ecology"}
Expected: 200, {playable:true, html:"<!doctype html>...", config:{type:"ecology"}}
```

### TC-18: Генерация прототипа 3D
```http
POST /api/v1/prototypes/generate
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","mode":"3d","type":"tower_defense"}
Expected: 200, {playable:true, html contains "three.min.js"}
```

### TC-19: Сохранение результата плейтеста
```http
POST /api/v1/playtests/save
Headers: Authorization: Bearer <token>
Body: {"project_id":"<id>","prototype_type":"engine","mode":"2d","outcome":"win","duration_sec":28}
Expected: 200, {id, saved:true}
```

### TC-20: Сквозной пайплайн — серверный (E2E, Фаза 1.7)
```http
POST /api/v1/pipeline/run-full-pipeline/<project_id>
Headers: Authorization: Bearer <token>
Body: {"idea":"A dark fantasy roguelike","format":"one_sheet","total_levels":30}
Expected: 200, {ok:true, stages_completed:8, stages_total:8, completion_percent:100}
```
Проверяет: все 8 блоков выполняются последовательно на сервере, данные персистятся в БД,
completion 0%→100% за ~1.2с.

### TC-21: Компиляция node-графа (2D + 3D, Фаза 2)
```http
POST /api/v1/prototype-graph/compile
Headers: Authorization: Bearer <token>
Body: {"graph":{"version":"1.0","settings":{"mode":"2d",...},"nodes":[...],"edges":[...]}}
Expected: 200, {valid:true, html:"<!doctype html>...", errors:[]}
```
Повторить с `mode:"3d"` — HTML должен содержать `three.min.js` и `THREE.`.

### TC-22: Soft-delete проекта (Фаза 4.7)
```http
DELETE /api/v1/projects/<id>
Expected: 200, {ok:true}
GET /api/v1/projects/<id>
Expected: 404, {detail:"Проект не найден"}
GET /api/v1/projects/?per_page=50
Expected: 200, total не включает удалённый
POST /api/v1/pipeline/run-full-pipeline/<id>
Expected: 404 (soft-deleted проект скрыт)
```

---

## 3. Test Cases — Негативные сценарии

### TC-N01: Доступ без токена
```http
GET /api/v1/auth/me
Expected: 401, {detail:"Не авторизован"}
```

### TC-N02: Невалидный токен
```http
GET /api/v1/auth/me
Headers: Authorization: Bearer invalid.token.here
Expected: 401, {detail:"Не авторизован"}
```

### TC-N03: Создание проекта без name
```http
POST /api/v1/projects/
Body: {"description":"test"}
Expected: 422, {detail:"Название проекта обязательно"}
```

### TC-N04: Доступ к чужому проекту
```http
GET /api/v1/projects/<other_user_project_id>
Expected: 404, {detail:"Проект не найден"}
```

### TC-N05: Концепция без idea
```http
POST /api/v1/concept/generate
Body: {"project_id":"<id>","idea":""}
Expected: 422, {detail:"Поле 'idea' обязательно..."}
```

---

## 4. Test Cases — UI/E2E (Agent Browser)

### TC-UI01: Главная страница рендерится
- Открыть /
- Проверить: заголовок "Gidede", 8 карточек блоков, без console errors

### TC-UI02: Логин
- Открыть /login
- Заполнить email, password
- Нажать "Войти"
- Проверить: redirect на /, sidebar показывает профиль

### TC-UI03: Создание проекта через шаблон
- Открыть /projects
- Нажать "Новый проект"
- Нажать "Шаблоны"
- Выбрать шаблон
- Нажать "Создать проект"
- Проверить: проект в списке

### TC-UI04: Страница прототипов
- Открыть /prototypes
- Выбрать проект
- Выбрать тип "tower_defense"
- Нажать "Сгенерировать прототип"
- Проверить: iframe с игрой

### TC-UI05: База знаний
- Открыть /knowledge
- Ввести "core loop" в поиск
- Проверить: результаты с секциями Библии
- Нажать "Показать полностью"
- Проверить: modal с markdown

### TC-UI06: Пайплайн
- Открыть /pipeline
- Выбрать проект
- Нажать "Запустить пайплайн"
- Проверить: прогресс-бар, 8 шагов, тосты

### TC-UI07: Dark mode
- Нажать toggle темы в sidebar
- Проверить: фон изменился на тёмный

### TC-UI08: Визуальная диаграмма Core Loop
- Открыть /blocks/2
- Сгенерировать core loop
- Проверить: SVG-диаграмма с шагами и стрелками

---

## 5. Performance тесты

### PERF-01: Время ответа API (без AI)
```bash
# Все API endpoints должны отвечать < 500ms
time curl -s http://localhost:3000/api/v1/health
# Expected: < 100ms
```

### PERF-02: Время ответа AI
```bash
# AI-запросы должны отвечать < 30 сек
time curl -s -X POST http://localhost:3000/api/v1/assistant/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Что такое MDA?"}'
# Expected: < 15 sec (typical: 5-10s)
```

### PERF-03: Генерация прототипа
```bash
# HTML генерация должна быть < 500ms
time curl -s -X POST http://localhost:3000/api/v1/prototypes/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<id>","mode":"2d","type":"engine"}'
# Expected: < 200ms
```

---

## 6. Security тесты

### SEC-01: SQL Injection
```http
POST /api/v1/auth/login
Body: {"email":"' OR 1=1 --","password":"x"}
Expected: 401, Prisma parameterized queries prevent injection
```

### SEC-02: XSS в GDD
```http
POST /api/v1/gdd/generate
Body: {"project_id":"<id>","format":"<script>alert(1)</script>"}
Expected: 422, validation rejects
```

### SEC-03: JWT tampering
```http
GET /api/v1/auth/me
Headers: Authorization: Bearer <modified_token>
Expected: 401, signature verification fails
```

### SEC-04: Path traversal
```http
GET /api/v1/projects/../../etc/passwd
Expected: 404, Next.js routing prevents
```

---

## 7. Автоматизация

### Запуск всех API тестов
```bash
#!/bin/bash
# scripts/run_api_tests.sh
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gidede.dev","password":"password123"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

ENDPOINTS=(
  "GET /api/v1/health"
  "GET /api/v1/auth/me"
  "GET /api/v1/projects/"
  "GET /api/v1/rag/stats"
  "GET /api/v1/assistant/status"
  "GET /api/v1/mechanics/stats"
)

for ep in "${ENDPOINTS[@]}"; do
  METHOD=$(echo $ep | cut -d' ' -f1)
  PATH_=$(echo $ep | cut -d' ' -f2)
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X $METHOD http://localhost:3000$PATH_ \
    -H "Authorization: Bearer $TOKEN")
  echo "$METHOD $PATH_ → $CODE"
done
```
