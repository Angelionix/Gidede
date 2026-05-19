# Agent Context: Task 2 — E2E Test Agent

## Task
Implement 4.E.6 — Комплексное E2E-тестирование from ROADMAP_PHASE4.md

## Work Done

### 1. Dependencies Installed
- `@playwright/test@1.60.0` added as dev dependency
- Chromium browser installed via `npx playwright install chromium`

### 2. Files Created

#### playwright.config.ts
- Test directory: `./e2e`
- Fully parallel execution
- CI: 2 retries, 1 worker, no `.only`
- Local: HTML reporter (open on failure) + list
- Timeout: 30s (test), 10s (expect)
- Base URL: `http://localhost:3000` (or `PLAYWRIGHT_BASE_URL` env var)
- Traces on first retry, screenshots only on failure, video retain on failure
- Chromium project only (Desktop Chrome)
- WebServer auto-start in CI only

#### e2e/auth.spec.ts — 5 tests
1. Register new user successfully
2. Register with existing email shows error
3. Login with valid credentials
4. Login with invalid password shows error
5. Protected route redirects to login when not authenticated

#### e2e/pipeline.spec.ts — 4 tests
1. Full pipeline: create project → fill Block 1 → navigate to Block 2
2. Block progress indicator updates after completing a block
3. Pipeline notification appears when upstream block changes
4. Stale blocks show warning indicator

#### e2e/balance.spec.ts — 3 tests
1. Enter balance data and run transitive analysis
2. Intransitive analysis with payoff matrix
3. Monte Carlo simulation runs and shows results

#### e2e/ai-assistant.spec.ts — 3 tests
1. Send message to AI assistant and receive response (SSE streaming mock)
2. Contextual suggestions appear based on current block
3. Proactive alerts display for economy pathologies

#### e2e/export.spec.ts — 2 tests
1. Generate GDD document with all sections
2. Export GDD to PDF format

### 3. Files Modified
- `package.json` — added `"test:e2e": "playwright test"` script
- `docs/ROADMAP_PHASE4.md` — marked 4.E.6 as ✅ completed

### 4. Mock Strategy
All API calls are mocked via `page.route()`:
- Auth endpoints: `/api/v1/auth/register`, `/auth/login`, `/auth/me`, `/auth/refresh`
- Projects: `/api/v1/projects/`
- Pipeline: `/api/v1/pipeline/state/`, `/pipeline/notify-updated`, `/pipeline/run-pipeline/`
- Concept: `/api/v1/concept/generate`
- Balance: `/api/v1/balance/analyze`
- AI Assistant: `/api/v1/assistant/chat/stream`, `/assistant/suggestions`, `/assistant/alerts`, `/assistant/history`
- GDD: `/api/v1/gdd/generate`, `/gdd/export`

### 5. Total Test Count
**17 E2E tests** across 5 scenarios (exceeds minimum 15 requirement):
- auth.spec.ts: 5
- pipeline.spec.ts: 4
- balance.spec.ts: 3
- ai-assistant.spec.ts: 3
- export.spec.ts: 2
