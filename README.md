# Beeroniza

**Self-hosted image generation from visual templates — browser editor included, REST API included.**

---

## What is this?

Beeroniza is a small, source-available tool that lets you design image templates in your browser and then generate images from them — either by hand through the web interface, or automatically via an API.

Think: social media cards, OpenGraph banners, post thumbnails, event visuals. You design the layout once, mark the parts that should change (headline, author photo, logo, background color), and from that point on you can generate new images just by filling in those blanks.

**Why does this exist?** I needed exactly this and couldn't find anything that worked the way I wanted: simple, self-hostable, with a real visual editor and an API for automation. Commercial services for this either charge per generated image (which adds up fast) or require sending all your content to their servers. So I built my own.

Is this a replacement for polished, fully-featured paid services? Probably not — those have dedicated teams and roadmaps. But if "generate pretty decent-looking preview images and social posts from a template via API" is what you need, this might be all you need. And if it is, you can save yourself quite a bit of money.

---

## How does it work in practice?

1. **Design a template** — open the browser editor, arrange text, images and shapes on a canvas, set fonts and colors.
2. **Mark placeholders** — tag any layer as a placeholder: a text field for a headline, an image slot for a photo, a color for a brand accent.
3. **Generate images** — either fill in the placeholders through the web UI and download the PNG, or call the REST API from your own application and get a generated image back.

That's it.

---

## Features at a glance

- **Visual canvas editor** in the browser — drag, resize, style
- **Placeholder system** — text, image, and color placeholders per layer
- **Web UI** with download button — no coding required to generate images
- **REST API** with API key authentication — asynchronous job queue, optional webhooks
- **Pixel-perfect output** — editor preview and server renderer use the exact same engine and fonts
- **16 bundled font families** (Inter, Roboto, Montserrat, Playfair Display, JetBrains Mono, and more) — served locally, no external CDN
- **Custom font upload** — bring your own typefaces
- **SSO / OIDC support** — integrate with Keycloak, Authentik, Zitadel, or any OpenID Connect provider
- **Fully self-contained** — your content and assets never leave your server

---

## Demo assets — try it out right away

The repository ships with a ready-to-use set of demo images in the `demo-assets/` folder. They were all generated with **Stable Diffusion** (model: arthemyComicsXL) and include comic-style avatar portraits, wide background images, and logo graphics — organized into five themed sets:

| Folder | Theme |
|---|---|
| `set-a-cyberpunk-neon` | Cyberpunk / neon-city superheroes |
| `set-b-mythic-north` | Fantasy-Norse warriors |
| `set-c-galactic-crew` | Space-faring cosmic heroes |
| `set-d-desert-frontier` | Desert-frontier adventurers |
| `set-e-brew-order` | Mystical alchemist brew-masters |
| `set-f-shiva-friends` | Cosmic deity warriors — anthropomorphic dog characters |

**How to use them:** After starting a fresh instance, go to the media library and upload the images from any of the folders. You'll then have real content to build and test templates with right away — no need to hunt for placeholder images first.

---

## Getting started

### Option A — Docker (recommended, easiest)

You need [Docker](https://www.docker.com/) installed. Then:

```bash
# 1. Copy the example config and open it
cp .env.example .env

# 2. At minimum, set AUTH_SECRET to a random string:
#    openssl rand -base64 32
#    Paste the result as AUTH_SECRET in your .env file

# 3. Start everything
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the default admin account:

| | |
|---|---|
| **Email** | `admin@example.org` |
| **Password** | `123456` |

> **Important:** Change the password before you expose the instance to the internet.

The admin account comes preloaded with a starter template library, so you can explore the editor right away.

---

### Option B — Local development (without Docker)

You'll need **Node.js 20+** and a running **PostgreSQL** database.

```bash
# 1. Copy and edit the config
cp .env.example .env
# → set DATABASE_URL to your Postgres connection string
# → set AUTH_SECRET to a random string (openssl rand -base64 32)

# 2. Install dependencies
npm install

# 3. Run database migrations and seed the admin account
npx prisma migrate dev
npm run db:seed

# 4. Download the bundled fonts (needed for rendering)
npm run fonts:fetch

# 5. Start the development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

---

## Deploying to a server

The app is a standard Node.js server — it runs behind any reverse proxy. Two self-hosting tools I personally really like and can genuinely recommend:

- **[Coolify](https://github.com/coollabsio/coolify)** — a beautiful, open-source Heroku/Netlify alternative you can run on your own VPS. Fantastic project, absolutely worth checking out.
- **[Dokku](https://github.com/dokku/dokku)** — a tiny, powerful PaaS built on Docker. If you like the `git push` workflow, Dokku is a dream. Also a great repo to know.

Both handle TLS, routing, and deployments with minimal configuration — and the Dockerfiles in this repo work out of the box with either of them.

For any other setup, a plain Docker Compose on a VPS works just fine:

```bash
cp .env.example .env   # fill in DATABASE_URL, AUTH_SECRET, APP_URL
docker compose up -d --build
```

Database migrations run automatically on each container start.

---

## Configuration reference

All settings are environment variables. Copy `.env.example` to `.env` as a starting point — it contains comments explaining each option.

**Required:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random secret for signing sessions — `openssl rand -base64 32` |

**Recommended:**

| Variable | Default | Description |
|---|---|---|
| `APP_URL` | `http://localhost:3000` | Public URL of your instance |
| `AUTH_TRUST_HOST` | `true` | Must be `true` when running behind a reverse proxy (Coolify, Nginx, Traefik…) |

**Optional:**

| Variable | Default | Description |
|---|---|---|
| `RUN_WORKER` | `true` | Run the image render worker inside the web container |
| `WORKER_CONCURRENCY` | `2` | How many images to render in parallel |
| `STORAGE_DRIVER` | `db` | Where to store generated files: `db` (in Postgres) or `local` (on disk) |
| `STORAGE_LOCAL_PATH` | `/app/storage` | Disk path when using `local` storage |
| `ALLOW_REGISTRATION` | `true` | Allow anyone to create an account. Set to `false` to lock the instance down. |
| `PORT` | `3000` | HTTP port |

### SSO / OpenID Connect (optional)

To enable login via an external identity provider (Keycloak, Authentik, Zitadel, or any OIDC-compatible provider), set:

```env
OIDC_ISSUER=https://your-idp.example.com/realms/myrealm
OIDC_CLIENT_ID=beeroniza
OIDC_CLIENT_SECRET=your-client-secret
OIDC_NAME=SSO    # Label shown on the login button
```

Register `{APP_URL}/api/auth/callback/oidc` as the redirect URI in your identity provider.

---

## Using the API

The REST API lives at `/api/v1`. To authenticate, create an API key in the dashboard and send it as:

```
Authorization: Bearer <your-api-key>
```

Image generation is asynchronous: you submit a job and receive a `job_id`, then either poll for the result or register a webhook URL to be notified when the image is ready.

Full documentation: [`docs/API.md`](./docs/API.md)
Interactive reference: `/api/v1/openapi.json` (served by your running instance)

---

## How it works under the hood

```
┌───────────────────────────┐      ┌──────────────────────────┐
│           app             │      │        PostgreSQL         │
│  Next.js + TypeScript     │◀────▶│  • application data      │
│  • visual editor (Fabric) │      │  • job queue (pg-boss)   │
│  • REST API + API keys    │      │  • file storage (bytea)  │
│  • render worker          │      └──────────────────────────┘
│    (pg-boss + Playwright) │
└───────────────────────────┘
   one container              one external dependency
```

- **PostgreSQL** is the only hard dependency. It stores everything: your data, the render job queue (via [pg-boss](https://github.com/timgit/pg-boss)), and generated images (by default). One database URL is enough to run the whole thing.
- **Rendering** is done by a headless Chromium browser (via Playwright) that loads the exact same template code and fonts as the editor — which is why the output always matches the preview.
- The render worker runs **inside the web container** by default. No separate services needed. If you want to scale, run multiple containers with `RUN_WORKER=true` and use `STORAGE_DRIVER=db` to share files via Postgres.

---

## Fonts & licensing

Beeroniza bundles 16 open-source font families — all licensed under the SIL Open Font License 1.1 or Apache 2.0. They ship with the app and are served locally so both the editor and the server renderer work completely offline, with no external font CDN involved.

Full attribution and license texts: [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md)

The application code is source-available under the **[Beeroniza Source Available License 1.0](./LICENSE)**, based on Apache 2.0 with an additional no-sell condition.

You may use Beeroniza personally, internally, or in your business, including to create commercial images and other outputs. You may not sell Beeroniza itself, charge for access to it, or offer it as a paid hosted service, managed service, SaaS, API service, on-demand image-generation service, or substantially similar commercial software product.

---

## Thanks

This project is built on the shoulders of some really great open-source work. A big, genuine thank you to the maintainers and contributors of **Next.js**, **React**, **Fabric.js**, **Playwright**, **pg-boss**, **Auth.js**, **Prisma**, **Bootstrap**, **Zod**, and all the type designers behind the bundled Google Fonts. Without their work, none of this would exist.

---

## A note on how this was built

Beeroniza was **generated almost entirely with the help of AI**. It works for me, and I hope it works for you too — but it comes with **no warranty of any kind**. Please review the code, test it for your use case, and make sure you're comfortable with what's running before putting it in front of real users.

I'm very open to feedback, bug reports, and pull requests. If something doesn't work or could be better, open an issue — I'll be happy to take a look.

I put this together because I couldn't find anything that did exactly what I needed. Hopefully it saves someone else the trouble of building it from scratch. 🍺
