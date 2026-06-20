/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hide the floating dev-mode indicator badge (dev only; no production effect).
  devIndicators: false,
  // Playwright / pg-boss are server-only deps that must never be bundled into
  // the client or traced into edge runtimes.
  serverExternalPackages: ["playwright", "playwright-core", "pg-boss", "pg", "bcryptjs"],
  // We render generated images ourselves; no remote image optimization needed.
  images: {
    unoptimized: true,
  },
  // Keep the production server lean & predictable behind the Coolify proxy.
  poweredByHeader: false,
  // The render worker drives a headless browser against
  // http://127.0.0.1:PORT/internal/render. Next 16 treats 127.0.0.1 as a
  // cross-origin dev request and otherwise rejects the HMR websocket upgrade,
  // which stalls client hydration so window.__bnzRender is never installed.
  // Allowing the loopback origin lets the dev render page hydrate. (No effect
  // in production — there is no HMR socket there.)
  allowedDevOrigins: ["127.0.0.1"],
  sassOptions: {
    // Allow `@import "bootstrap/scss/..."` to resolve from node_modules.
    loadPaths: ["node_modules"],
    // Bootstrap 5.3 still uses @import internally; silence the noise.
    silenceDeprecations: [
      "import",
      "mixed-decls",
      "color-functions",
      "global-builtin",
      "legacy-js-api",
    ],
  },
};

export default nextConfig;
