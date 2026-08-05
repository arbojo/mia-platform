# Testing & QA Strategy — MIA Platform

This document defines the professional testing infrastructure, commands, and quality gates for MIA Platform. It is the operational reference for the QA Engineer and all contributors.

## 1. Test Layers

| Layer | Framework | Location | Environment | Purpose |
|-------|-----------|----------|-------------|---------|
| **Unit** | Vitest | `tests/**/*.test.ts` | Node | Pure functions, business logic, adapters, service modules |
| **Component** | Vitest + Testing Library | `tests/component/*.test.tsx` | jsdom | React components: render, interaction, accessibility, state |
| **API Routes** | Vitest (mocked handlers) | `tests/api/*.test.ts` | Node | Route handlers: input validation, auth, error mapping |
| **Integration** | Vitest | `tests/{runtime,sales,knowledge,i18n,channels,health,context}` | Node | Cross-module flows with Supabase/OpenAI mocks |
| **E2E** | Playwright | `tests/e2e/*.spec.ts` | Chromium/Firefox/Mobile | Real browser: auth flows, navigation, public pages |
| **Accessibility** | Vitest | `tests/accessibility/accessibility.test.ts` | Node | Static a11y rules on components/utilities |

## 2. Test Pyramid Targets

Current coverage goals (enforced by `vitest.config.ts`):

| Metric | Threshold |
|--------|-----------|
| Lines | ≥ 70% |
| Functions | ≥ 70% |
| Branches | ≥ 60% |
| Statements | ≥ 70% |

Excluded from coverage: `src/app/**` (route glue), `src/components/ui/**` (shadcn primitives), test/workshop/script/config files.

## 3. Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Playwright e2e (full multi-browser matrix) |
| `npm run test:all` | Full suite: unit + component + e2e |
| `npm run test:unit` | All Vitest tests (unit + component + api + integration), CI mode |
| `npm run test:unit:watch` | Vitest watch mode for TDD |
| `npm run test:component` | Component tests only (jsdom) |
| `npm run test:coverage` | Run Vitest with coverage report + thresholds |
| `npm run test:e2e` | Playwright e2e |
| `npm run test:e2e:headed` | Playwright e2e with visible browser |
| `npm run test:e2e:ui` | Playwright UI mode (interactive) |
| `npm run test:e2e:report` | Open Playwright HTML report |
| `npm run test:install` | Install all Playwright browsers (chromium, firefox, webkit) |
| `npm run lint` | ESLint (0 errors, 0 warnings) |
| `npm run build` | Production build (strict TS) |

## 4. Playwright Matrix

`playwright.config.ts` defines four projects:

| Project | Device | Rationale |
|---------|--------|-----------|
| `chromium` | Desktop Chrome | Primary coverage |
| `firefox` | Desktop Firefox | Cross-browser compatibility |
| `mobile-chrome` | Pixel 7 | Android viewport + touch |
| `mobile-safari` | iPhone 13 | iOS viewport + WebKit |

Artifacts on failure: trace (`on-first-retry`), screenshot, video. Report: HTML.

## 5. Vitest Projects

`vitest.config.ts` defines two isolated projects sharing fixtures and mocks:

- **unit** (node): `tests/**/*.test.ts`
- **component** (jsdom): `tests/component/**/*.test.tsx`

Shared infra:
- `tests/setup.ts` — stubs env vars (Supabase, OpenAI)
- `tests/setup-component.ts` — jest-dom matchers + RTL cleanup
- `tests/fixtures.ts` — canonical fake entities (business, assistant, products, etc.)
- `tests/mocks/supabase.ts` — chainable query-builder mock
- `tests/mocks/openai.ts` — completions + streaming mock
- `tests/mocks/stream.ts` — Vercel AI SDK `streamText` mock

## 6. Quality Gates (per governance)

| Gate | Command | Pass Criteria |
|------|---------|---------------|
| lint | `npm run lint` | 0 errors, 0 warnings |
| build | `npm run build` | Successful production build |
| unit_tests | `npm run test:unit` | All files pass |
| e2e_tests | `npm test` | All projects pass |
| chrome_devtools | Chrome DevTools MCP | No console errors, no failed requests |
| security_review | Security Engineer | Approved |
| performance_review | Performance Engineer | Approved |

## 7. Writing Tests — Conventions

1. **One behavior per test** — clear `it('...', ...)` descriptions
2. **Use fixtures** — never hardcode entity shapes; import from `tests/fixtures.ts`
3. **Mock external calls** — Supabase via `createMockSupabase()`, OpenAI via `createMockOpenAIClient()`, streams via `createMockStreamText()`
4. **Component tests** — prefer `screen.getByRole`, `getByLabel`, `getByText` over class selectors
5. **E2E** — test real user journeys; avoid artificial waits (`waitForTimeout`); use `expect(...).toBeVisible()` with auto-retry
6. **Name files by module** — `tests/<domain>/<module>.test.ts`, `tests/component/<name>.test.tsx`, `tests/api/<route>.test.ts`
7. **No production code in tests** — assert behavior, not implementation details

## 8. Regression Prevention

- Every PR runs the full CI pipeline (`.github/workflows/ci.yml`): lint → build → unit+coverage → e2e
- Intermittent failures: run 3x, check timing/resource contention, document before fixing
- Environment-specific failures: verify env parity (env vars, Node version, browsers) before touching code
- Coverage regressions below thresholds fail `npm run test:coverage`

## 9. QA Verification Report

After every task, the QA Engineer produces a report:

```markdown
## QA Verification Report

### Task: [Description]
### Date: [Date]

### Gate Results
- [x] Lint: PASS
- [x] Build: PASS
- [x] Unit & Component: PASS (N tests)
- [x] E2E: PASS (N projects, N tests)
- [x] DevTools: PASS

### Coverage
- Lines: X% | Functions: X% | Branches: X% | Statements: X%

### Issues Found
- none

### Recommendation
APPROVED
```
