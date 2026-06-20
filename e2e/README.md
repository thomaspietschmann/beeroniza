# End-to-end tests (Playwright)

Browser tests for the editor, media library, templates and admin guards. Every
test records a **video** kept under `test-results/` as a CI artifact, plus an
HTML report (`playwright-report/`).

## Isolation — never touches real data

`global-setup.ts` creates a dedicated test user `e2e@beeroniza.test` with its own
freshly seeded starter templates; `global-teardown.ts` deletes that user, and the
`onDelete: Cascade` relations remove all of its templates, usages, generations,
uploaded media and brand kit. Tests authenticate as this user, so they only ever
see their own data. **In CI, additionally point `DATABASE_URL` at a throwaway test
database** so production is never involved.

## Run locally

```bash
npm run e2e            # boots the dev server (reused if already running), seeds, runs, tears down
npm run e2e:report     # open the last HTML report
```

## Run in a pipeline

The runner needs a Postgres database, the migrations applied, and the Chromium
browser installed.

**Only run it on meaningful events** — the suite boots the app and a browser, so
it is too heavy for every push. Trigger it on pull requests, on pushes to `main`,
and manually:

```yaml
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:
```

Example job:

```yaml
services:
  postgres:
    image: postgres:18
    env: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: beeroniza_test }
    ports: ["5432:5432"]
env:
  DATABASE_URL: postgres://postgres:postgres@localhost:5432/beeroniza_test
  AUTH_SECRET: test-secret-not-for-production
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version: 24 }
  - run: npm ci
  - run: npx prisma migrate deploy
  - run: npx playwright install --with-deps chromium
  - run: npm run e2e            # global-setup seeds the test user; dev server auto-starts
  - uses: actions/upload-artifact@v4
    if: always()
    with:
      name: playwright-report
      path: |
        playwright-report/
        test-results/
```

Playwright starts the app itself (`webServer` in `playwright.config.ts`). With
`CI=1` it does not reuse an existing server and enables a retry.
