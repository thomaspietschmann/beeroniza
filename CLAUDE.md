# Beeroniza — Development Guide

Self-hosted image generation from visual templates, with a web editor and a REST
API. Open source. **Generated with AI; no warranty — use at your own risk.**

## Stack
- **Next.js 16** (App Router) + **TypeScript** + **React 19**
- **PostgreSQL** via **Prisma 7** (driver adapter `@prisma/adapter-pg`) — the ONLY
  hard dependency. Postgres also holds the job queue (**pg-boss**) and, by
  default, stored files (`StoredFile.data` bytea).
- **Auth.js v5** (credentials, JWT sessions)
- **Fabric.js v7** editor; **Playwright** (headless Chromium) server renderer
- **Bootstrap 5** via SCSS variables (no CDN); **react-bootstrap**

## Commands
- Dev server: `npm run dev` (runs the in-process render worker too)
- Typecheck (the gate — eslint flat-config is currently broken): `npx tsc --noEmit`
- Build: `npm run build`  ·  Start: `npm run start`
- Prisma: `npx prisma migrate dev` / `npx prisma generate` / `npm run db:seed`
- Fonts (fetched at build, NOT committed): `npm run fonts:fetch`
- Standalone worker: `npm run worker`

## Hard rules / conventions
- **No CDN.** Fonts are bundled (OFL/Apache, fetched at build into `public/fonts`,
  gitignored). Bootstrap/Fabric/Swagger UI all via npm.
- **Prisma 7**: no `url` in `schema.prisma`; the connection lives in
  `prisma.config.ts` (CLI) and `src/lib/db.ts` instantiates the client with the
  pg driver adapter. A real `DATABASE_URL` must be in env (a dummy is set in the
  Dockerfile build stage so build-time `prisma generate` / `next build` work).
- **Single shared render path** = pixel parity: the editor preview AND the server
  renderer both run `src/lib/template/fabric-render.ts` with the same bundled
  `@font-face` fonts. The worker drives `/internal/render` in Chromium.
- Keep `de/en/ch`… N/A here. Prefer double quotes; follow existing patterns.
- Dev server runs on port **3939** in this workspace; the host already has a
  Postgres on 5432 (db `beeroniza`, user/pw `postgres`). Dev admin user:
  `admin@example.org` / `123456` (created by the seed).

## Core model
- **Template** = a Fabric canvas JSON (`Template.data`, a `TemplateDoc`, see
  `src/lib/template/schema.ts`) + derived `placeholders`. Layers carry custom
  props (`BNZ_PROPS` in fabric-render.ts): `bnzName` (= API key), `bnzPlaceholder`
  `{type:text|image|color}`, `bnzClip`, `bnzFit`/`bnzMaxHeight` (text auto-fit),
  `bnzImageFit` (cover|contain) / `bnzImageAlign` (logos in rectangles).
- **Usage** = a saved, named set of input VALUES for a template (`{key:{text|
  fileId|color}}`). It stores inputs, not a baked image, so it always re-renders
  against the CURRENT template. See `src/lib/usages.ts`.
- **Generation** (async, pg-boss): `createGeneration` → enqueue → worker renders
  → `StoredFile`. Public API mirrors this under `/api/v1`.
- Fillable shapes: a Rect/Circle marked `image` is filled with a cropped (cover)
  or contained image at render — see `fillShapeWithImage`.

## Layout
- `src/app/(app)/**` — authed UI (dashboard, templates, editor, usages, api-keys).
  Editor is full-bleed; the global navbar is hidden there.
- `src/app/api/**` — internal JSON API; `src/app/api/v1/**` — public API-key API.
- `src/server/**` — pg-boss queue, Playwright render, in-process worker
  (started from `src/instrumentation.ts` when `RUN_WORKER=true`).
- `src/components/editor/**` — the Fabric editor.
- API docs: OpenAPI at `/api/v1/openapi.json`, Swagger UI at `/api-docs`,
  prose at `docs/API.md`.

## Deploy
- Docker: `docker compose up --build` (2 services: app + postgres). Set
  `AUTH_SECRET`; override host port with `APP_PORT=...`.
- Coolify: build the Dockerfile, attach Postgres, set `DATABASE_URL` +
  `AUTH_SECRET`. Migrations run on container start (entrypoint).
- **Horizontal scaling:** run multiple replicas of the same app image.
  `RUN_WORKER=true` on replicas that should pull render jobs; the renderer
  always calls `127.0.0.1:PORT/internal/render` — each replica renders the
  jobs it picks up itself. File storage: `STORAGE_DRIVER=db` (bytes in Postgres,
  zero extra infra) works across any number of replicas. With `STORAGE_DRIVER=local`
  all replicas must share the same volume.
- **OIDC/SSO** (optional): set `OIDC_ISSUER`, `OIDC_CLIENT_ID`,
  `OIDC_CLIENT_SECRET` to enable a generic OpenID Connect provider (Keycloak,
  Authentik, Zitadel, …). `OIDC_NAME` sets the button label (default: "SSO").
  Register `{APP_URL}/api/auth/callback/oidc` as the redirect URI in your IdP.
