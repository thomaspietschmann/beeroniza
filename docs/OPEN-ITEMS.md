# Open items & known gaps

Status of the Beeroniza app as of the initial AI-assisted build. The core is
working and verified end-to-end (locally, via the web UI, via the REST API, and
inside the Docker container). This lists what is **not** yet done, grouped by
priority. Generated with AI — review before relying on any of it.

## ✅ Done & verified
- Auth (register/login, JWT), multi-user with per-user templates/keys/usages.
- Visual editor (Fabric.js): add text/shapes/images, background image as a
  movable layer, snapping guides, clip shapes, dynamic-field toggle, template
  inputs (API) list, top-bar layout, unsaved-changes guard, navbar hidden.
- Render pipeline: pg-boss (in Postgres, no Redis) + in-process Playwright/
  Chromium worker; pixel parity via the shared Fabric render module; text
  auto-fit; fillable shapes (image cropped to shape); logo contain-fit + L/C/R
  align; PNG transparency.
- Usages: saved input sets per template, re-rendered against the current
  template; web fill UI with live preview + generate + download.
- REST API v1 (API keys with expiry + rotation, uploads, async images),
  OpenAPI 3.1 at `/api/v1/openapi.json`, Swagger UI at `/api-docs`, `docs/API.md`.
- Bundled OFL fonts (fetched at build, not committed) + licensing files.
- Docker build + `docker compose` (app + postgres) verified incl. in-container
  render. Coolify-ready.
- 5 example templates seeded for the admin user (article ×3, podcast, event).

## 🔴 Before an open-source release
- **No automated tests.** All verification so far was manual / agent-driven. Add
  at least: unit tests for `fabric-render` modifications + `usages`/`generations`
  helpers, and an API integration test (`/api/v1/images` happy path + auth).
- **ESLint is broken** (flat-config circular-config crash) — `npm run lint`
  fails; we rely on `tsc`. Fix `eslint.config.mjs` so lint runs in CI.
- **No CI** (GitHub Actions): add typecheck + build + tests on PR.
- **API rate limiting not implemented.** Public `/api/v1/*` has API-key auth but
  no throttling. Add per-key rate limits before exposing publicly.
- **Not committed/pushed.** Repo is initialised (remote
  `github.com:thomaspietschmann/beeroniza`, branch `main`) but has no commits.
- **Secrets/prod hardening**: `AUTH_SECRET` must be set (placeholder in compose);
  consider `ALLOW_REGISTRATION=false` after first account; webhooks are sent
  unsigned (no HMAC secret) — add a signature if used across trust boundaries.

## 🟠 Promised / designed but not built
- **Editor control for image fit/align** (cover vs contain, left/center/right):
  it's baked into seeded templates and supported by the renderer + data model,
  but there is no toggle yet in the editor Properties panel. Add it for
  image / logo placeholders.
- **Custom font upload.** The `Font` model + `/api/fonts` listing exist and
  bundled fonts are seeded, but there is **no upload endpoint/UI** for users to
  add their own fonts per instance. (Legal note: uploaded fonts are the instance
  operator's responsibility — see README.)
- **Example templates aren't provisioned for new users.** New accounts get the
  basic author-card starters via `createUser`; the 5 richer INNOQ templates are
  admin-only (created via `scripts/seed-*-template.ts`). Decide whether to ship
  them as starters for everyone.

## 🟡 Nice-to-have / future
- Storage: both `db` (Postgres bytea) and `local` (mounted volume, relative
  storage keys) drivers are implemented and tested end-to-end; docker-compose
  uses `local` with a `beeroniza_storage` volume by default. No S3 adapter yet,
  and no retention/cleanup for old generated images.
- Render scaling: single shared Chromium; `WORKER_CONCURRENCY` only; not load-
  tested. The worker can be split out (`RUN_WORKER=false` + `npm run worker`)
  but that path isn't verified.
- Public API: no single-template `GET /api/v1/templates/:id`, no pagination on
  list endpoints, no per-key scopes.
- Multi-tenancy: single-user accounts only (no orgs/teams) — a deliberate v1
  scope decision.
- Dead code: `src/components/generate/GenerateForm.tsx` is orphaned (replaced by
  the usages fill view) and can be removed.
- Brand fidelity: example templates use placeholder/test assets and **Work Sans**
  as the title font (approximation); the real INNOQ brand font, logo PNG and
  backgrounds are filled per template, not bundled.
- Editor: image fit on plain `Image` objects (not shapes) always cover-fits;
  contain/align currently apply via shape (rectangle) image-frames.

## Notes
- This project was generated with AI and ships **without warranty**. Treat the
  above as a starting backlog, not an exhaustive audit.
