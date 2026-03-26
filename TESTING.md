# RecruitHUB Testing Guide

This document describes how to run the full test suite for the RecruitHUB application: backend unit and integration tests (Jest), frontend component tests (Vitest), and end-to-end browser tests (Playwright).

---

## Quick Start

Run everything from the repo root:

```bash
npm run test:all
```

This runs backend tests then frontend tests sequentially. E2E tests require the application to be running first (see below).

---

## Backend Tests (Jest)

The backend test suite lives in `Amoha Pathfinder/backend/tests/`. It includes:

- **Unit tests** (`tests/unit/`) — controllers, middleware, utilities; all DB calls are mocked.
- **Integration tests** (`tests/integration/`) — full request/response chains via `supertest`; DB is still mocked so no real MySQL server is required.

```bash
cd "Amoha Pathfinder/backend"

npm test                   # run all tests (unit + integration)
npm run test:unit          # unit tests only
npm run test:integration   # integration tests only
npm run test:coverage      # all tests with coverage report (lands in coverage/)
npm run test:watch         # watch mode for development
```

### Coverage targets

| Category          | Target |
|---|---|
| Unit tests        | >90%   |
| Integration tests | >80%   |

### How the DB mock works

`tests/setup.js` replaces `src/config/db` with a Jest mock before any test file loads. Individual test files can import `tests/helpers/db.mock.js` to control query return values per test.

---

## Frontend Tests (Vitest)

Frontend component and hook tests live in `Amoha Pathfinder/frontend/src/` (co-located) and `Amoha Pathfinder/frontend/src/test/`.

```bash
cd "Amoha Pathfinder/frontend"

npm test                   # run once (CI mode)
npm run test:watch         # watch mode — reruns on file save
```

To collect a coverage report, add the `--coverage` flag:

```bash
npm test -- --run --coverage
```

### Coverage target

| Layer    | Target |
|---|---|
| Frontend | >85%   |

---

## E2E Tests (Playwright)

E2E tests live in `Amoha Pathfinder/e2e/tests/`. They test complete user flows in a real Chromium browser.

### Prerequisites

Both application servers must be running before Playwright can connect:

```bash
# Terminal 1 — Backend
cd "Amoha Pathfinder/backend"
npm start          # listens on http://localhost:4000

# Terminal 2 — Frontend
cd "Amoha Pathfinder/frontend"
npm run dev        # listens on http://localhost:8080
```

### Install Playwright browsers

Only needs to be done once (or after updating `@playwright/test`):

```bash
cd "Amoha Pathfinder/e2e"
npx playwright install chromium
```

### Run the tests

```bash
cd "Amoha Pathfinder/e2e"

npm test                      # headless Chromium, list reporter
npm run test:headed           # headed mode — see the browser
npm run test:ui               # interactive UI mode (recommended for debugging)
npm run test:debug            # step-through debugger

# Run a single spec file
npm run test:auth
npm run test:navigation
npm run test:candidates
npm run test:attendance
npm run test:leaves

# Open the HTML report from the last run
npm run test:report
```

### Test structure

| File | Covers |
|---|---|
| `tests/auth.spec.ts` | Login form, error handling, redirect behaviour, sign-out |
| `tests/navigation.spec.ts` | Sidebar links, route transitions, 404 page |
| `tests/candidates.spec.ts` | Candidate list, search, enrollment form validation |
| `tests/attendance.spec.ts` | Attendance page load, check-in/out buttons, calendar |
| `tests/leaves.spec.ts` | Leave balance, apply form, status badges |

### Mocked vs live tests

Most tests mock the `auth/me` and API endpoints via `page.route()` so they run without a real database. Tests that require a fully seeded database are wrapped in `test.skip` and labelled with a `live:` prefix in their description. To run those, remove the `.skip`, ensure the backend is running with seed data, and use a valid director account (`DIR001` / `Admin@123`).

### Page Object Models

Reusable page abstractions live in `tests/pages/`:

- `LoginPage.ts` — login form selectors and actions
- `CandidatesPage.ts` — candidate list and enrollment form

Shared auth helpers live in `tests/helpers/auth.ts`.

### Coverage target

| Layer | Target |
|---|---|
| E2E   | All critical user paths covered |

---

## CI/CD

Two GitHub Actions workflows handle automated testing:

### `test.yml` — triggered on push to `main`/`develop` and PRs to `main`

| Job | What it does |
|---|---|
| `backend-unit-tests` | Runs Jest unit tests + uploads coverage artefact |
| `backend-integration-tests` | Runs Jest integration tests (depends on unit job) |
| `frontend-unit-tests` | Runs Vitest + uploads coverage artefact |
| `e2e-tests` | Starts both servers, runs Playwright, uploads report + screenshots |

### `coverage.yml` — triggered on PRs

Generates coverage for both layers and posts a summary comment to the PR.

---

## Artefacts

After a CI run the following artefacts are available in GitHub Actions:

| Artefact | Contents | Retained |
|---|---|---|
| `backend-unit-coverage` | Jest LCOV + text coverage | 14 days |
| `frontend-unit-coverage` | Vitest LCOV coverage | 14 days |
| `playwright-report` | HTML Playwright report (always) | 14 days |
| `playwright-test-results` | Screenshots + videos (failures only) | 7 days |
| `backend-coverage-report` | Full LCOV (coverage workflow) | 30 days |
| `frontend-coverage-report` | Full LCOV (coverage workflow) | 30 days |
