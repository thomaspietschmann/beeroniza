# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
# Plain Node image for the build: `next build` (SWC) is reliable here on both
# amd64 and arm64. Building under the Playwright/Ubuntu image segfaulted
# `next build` on amd64 (SIGSEGV), so the build stays on node:24-bookworm.
FROM node:24-bookworm AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time-only placeholders so `prisma generate` / `next build` can load
# config + server modules without a real database. Overridden at runtime.
# Skip browser download — the runtime image (mcr.microsoft.com/playwright) ships
# Chromium pre-installed; downloading it again here would waste RAM and time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-time-placeholder" \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
# Cache mount survives layer-cache invalidation (e.g. Coolify injecting changing
# build ARGs), so a busted `npm ci` still reuses the download cache.
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

# Fetch the bundled open-source fonts into public/fonts (not committed to git),
# then generate the Prisma client and build the Next.js app.
RUN npm run fonts:fetch
RUN npx prisma generate
RUN npm run build

# Collect NOTICE files from Apache-2.0-licensed dependencies (required by that
# license when distributing). Scoped packages (@scope/name) sit at depth 3.
RUN find node_modules -maxdepth 3 -name NOTICE | sort | while IFS= read -r f; do \
      pkg=$(echo "$f" | sed 's|node_modules/||; s|/NOTICE$||'); \
      printf '=== %s ===\n' "$pkg"; \
      cat "$f"; \
      printf '\n'; \
    done > THIRD_PARTY_NOTICES.txt

# ── Runtime stage ────────────────────────────────────────────────────────────
# Playwright image ships Chromium + all its OS deps pre-installed, so we skip
# the expensive `playwright install --with-deps chromium` step (apt + ~150MB
# download) that otherwise re-runs on every build and hammers the VPS. Same
# Node 24 + glibc family as the build image, and Prisma resolves to the same
# engine target (debian-openssl-3.0.x) on Debian and Ubuntu-noble, so the
# node_modules carried over from the build stage are ABI-compatible.
#
# IMPORTANT: the tag MUST match the "playwright" version in package.json so the
# pre-baked browser matches the API. Bump both together.
FROM mcr.microsoft.com/playwright:v1.61.0-noble AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=3000

# Bring over the installed dependencies (incl. generated Prisma client and the
# Playwright npm package) and the built app. No browser download needed — the
# base image already contains Chromium under /ms-playwright.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# License and attribution files required for distribution
COPY --from=build /app/LICENSE /app/NOTICE /app/THIRD_PARTY_LICENSES.md /app/THIRD_PARTY_NOTICES.txt ./

# The app runs from the compiled .next output, but the DB seed and the optional
# standalone worker run TypeScript via tsx and import from src/. tsx is in
# node_modules.
COPY --from=build /app/src ./src

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
