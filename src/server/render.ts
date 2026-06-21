import { chromium, type Browser, type Page } from "playwright";
import { env } from "@/lib/env";
import type { Modification, TemplateDoc } from "@/lib/template/schema";

// A single shared headless Chromium instance renders all jobs. It loads the
// app's own /internal/render page, which exposes window.__bnzRender — the exact
// same Fabric rendering code (and the same @font-face fonts) the editor uses.
// That shared code path is what makes the output match the editor preview.
//
// Pages are POOLED and reused across jobs: navigating /internal/render compiles
// the client bundle and loads the @font-face set, which is expensive to repeat
// per render. A warm page only needs a fresh page.evaluate(__bnzRender) per job
// (each call builds and disposes its own canvas, so no per-render reset needed).

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
  }
  return browserPromise;
}

// Concurrency permits (decoupled from the warm-page stack) cap how many renders
// run at once; the idle stack holds warmed-up, reusable pages.
const maxConcurrency = Math.max(1, env.workerConcurrency);
// Hard cap on queued waiters: prevents unbounded in-memory accumulation when all
// permits are held by hung renders.
const maxWaiters = maxConcurrency * 8;
let permits = maxConcurrency;
const permitWaiters: Array<() => void> = [];
const idlePages: Page[] = [];

function takePermit(): Promise<void> {
  if (permits > 0) {
    permits--;
    return Promise.resolve();
  }
  if (permitWaiters.length >= maxWaiters) {
    return Promise.reject(new Error("Render queue full — too many concurrent jobs"));
  }
  return new Promise<void>((resolve) => permitWaiters.push(resolve));
}

function givePermit(): void {
  const waiter = permitWaiters.shift();
  if (waiter) waiter();
  else permits++;
}

async function createWarmPage(): Promise<Page> {
  const browser = await getBrowser();
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: 1024, height: 1024 },
  });

  // Reach the render page on the LOCAL server (same process/container) via an
  // explicit loopback address + the configured PORT. Independent of APP_URL
  // (the public URL, which may point at a proxy), and avoids IPv6 ambiguity.
  const renderOrigin = `http://127.0.0.1:${env.port}`;
  const renderUrl = `${renderOrigin}/internal/render`;

  // Egress lock: allow only data: URLs and same-origin requests (the render
  // page + its /_next/* bundle assets). Abort everything else — after
  // inlineDocImages all template/mod images are data: URLs, so no legitimate
  // render needs to reach an external host.
  //
  // The /internal/* gate secret is attached only to the top-level document
  // request, not as a blanket setExtraHTTPHeaders on every sub-resource, so it
  // cannot be exfiltrated to an attacker's server via a crafted template src.
  await page.route("**", async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith("data:")) {
      return route.continue();
    }
    if (url.startsWith(renderOrigin)) {
      const merged: Record<string, string> = { ...req.headers() };
      if (req.resourceType() === "document" && url === renderUrl) {
        merged["x-bnz-internal-render"] = env.authSecret;
      }
      return route.continue({ headers: merged });
    }
    // Abort all external requests — template images must be pre-inlined.
    return route.abort();
  });

  await page.goto(renderUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(
    () => typeof (window as Window & { __bnzRender?: unknown }).__bnzRender === "function",
    undefined,
    // Generous: covers cold environments where the render route's client bundle
    // is compiled on first hit (e.g. a freshly started dev server).
    { timeout: 45000 },
  );
  return page;
}

export interface RenderInput {
  doc: TemplateDoc;
  modifications: Modification[];
  format: "png" | "jpg" | "webp";
  multiplier?: number;
  // @font-face rules (data: URLs) for the owner's custom / Google-imported
  // fonts, injected into the render page before fonts are awaited.
  fontFaceCss?: string;
}

export async function renderImage(input: RenderInput): Promise<Buffer> {
  await takePermit();
  let page: Page | null = null;
  let reusable = false;
  try {
    page = idlePages.pop() ?? (await createWarmPage());

    const renderTimeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Render timed out after ${env.renderTimeoutMs} ms`)),
        env.renderTimeoutMs,
      ),
    );

    const dataUrl = await Promise.race([
      page.evaluate(
        async (args) => {
          const w = window as unknown as {
            __bnzRender: (
              doc: unknown,
              mods: unknown,
              opts: { format: string; multiplier: number; fontFaceCss?: string },
            ) => Promise<string>;
          };
          const fmt =
            args.format === "jpg" ? "jpeg" : args.format === "webp" ? "webp" : "png";
          return w.__bnzRender(args.doc, args.modifications, {
            format: fmt,
            multiplier: args.multiplier,
            fontFaceCss: args.fontFaceCss,
          });
        },
        {
          doc: input.doc,
          modifications: input.modifications,
          format: input.format,
          multiplier: input.multiplier ?? 1,
          fontFaceCss: input.fontFaceCss ?? "",
        },
      ),
      renderTimeout,
    ]);

    const base64 = dataUrl.startsWith("data:") ? dataUrl.split(",")[1] ?? "" : "";
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0) {
      throw new Error("Renderer returned an empty image");
    }
    reusable = true; // the page survived the render — return it to the pool
    return buffer;
  } finally {
    if (page) {
      if (reusable) idlePages.push(page);
      else await page.close().catch(() => undefined);
    }
    givePermit();
  }
}

export async function closeBrowser(): Promise<void> {
  idlePages.length = 0;
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
