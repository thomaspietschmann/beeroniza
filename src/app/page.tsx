import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const userCount = await prisma.user.count();
  const allowRegistration = env.allowRegistration || userCount === 0;

  return (
    <div className="bnz-landing">

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="bl-nav" aria-label="Main navigation">
        <Link href="/" className="bl-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bee/beeroniza-bee-mark.png" alt="" width={32} height={32} />
          <span className="bl-wordmark">Beeroniza</span>
        </Link>
        <div className="bl-nav-actions">
          <Link href="/login" className="bl-btn-ghost">Sign in</Link>
          {allowRegistration && (
            <Link href="/register" className="btn btn-primary btn-sm">Get started</Link>
          )}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="bl-hero">
        <div className="bl-hero-inner">
          <div className="bl-hero-text">
            <span className="bl-eyebrow">Source-available · Self-hosted · Free forever</span>
            <h1 className="bl-headline">
              Template once.<br />
              Generate<br />
              <span className="bl-headline-amber">forever.</span>
            </h1>
            <p className="bl-sub">
              Design a canvas in your browser. Mark placeholders for text, images, and colors.
              Then generate unlimited social cards, OG banners, and thumbnails — from the web UI
              or a single API call. Your data never leaves your server.
            </p>
            <div className="bl-ctas">
              {allowRegistration ? (
                <>
                  <Link href="/register" className="btn btn-primary btn-lg">Self-host in minutes</Link>
                  <Link href="/login" className="bl-btn-ghost bl-btn-ghost--lg">Sign in</Link>
                </>
              ) : (
                <Link href="/login" className="btn btn-primary btn-lg">Sign in</Link>
              )}
            </div>
          </div>

          <div className="bl-hero-visual" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero-illustration.png"
              alt=""
              className="bl-hero-img"
            />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="bl-features">
        <div className="bl-container">
          <h2 className="visually-hidden">Features</h2>
          <div className="bl-features-grid">

            <div className="bl-feature">
              <div className="bl-feat-icon bl-feat-icon--indigo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/feat-canvas.svg" alt="" width={20} height={20} />
              </div>
              <h3 className="bl-feat-title">Browser-based canvas editor</h3>
              <p className="bl-feat-desc">
                No Figma plugin, no export step. Drag, resize, and style layers. Mark any layer
                as a placeholder — text, image, or color — and it becomes a fill-in field for
                every generated image.
              </p>
            </div>

            <div className="bl-feature">
              <div className="bl-feat-icon bl-feat-icon--amber">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/feat-api.svg" alt="" width={20} height={20} />
              </div>
              <h3 className="bl-feat-title">REST API with async job queue</h3>
              <p className="bl-feat-desc">
                Fire-and-forget from CI, cron, or your backend. Submit a job, get an ID back,
                then poll or register a webhook. One API key, one endpoint, unlimited images.
              </p>
            </div>

            <div className="bl-feature">
              <div className="bl-feat-icon bl-feat-icon--dark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/feat-db.svg" alt="" width={20} height={20} />
              </div>
              <h3 className="bl-feat-title">One Postgres instance. Nothing else.</h3>
              <p className="bl-feat-desc">
                Job queue, file storage, fonts — all bundled. No external services, no data
                egress, no per-image pricing. One database URL is enough to run the whole thing.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="bl-how">
        <div className="bl-container">
          <h2 className="bl-section-title">How it works</h2>
          <div className="bl-steps">

            <div className="bl-step">
              <div className="bl-step-n">01</div>
              <div className="bl-step-body">
                <div className="bl-step-title">Design a template</div>
                <div className="bl-step-desc">
                  Open the canvas editor, arrange text, images, and shapes. Works entirely in
                  your browser — no install required.
                </div>
              </div>
            </div>

            <div className="bl-step-arrow" aria-hidden="true">→</div>

            <div className="bl-step">
              <div className="bl-step-n">02</div>
              <div className="bl-step-body">
                <div className="bl-step-title">Mark placeholders</div>
                <div className="bl-step-desc">
                  Tag any layer as a fill-in field. A headline, a photo, a brand color — each
                  becomes an API parameter.
                </div>
              </div>
            </div>

            <div className="bl-step-arrow" aria-hidden="true">→</div>

            <div className="bl-step">
              <div className="bl-step-n">03</div>
              <div className="bl-step-body">
                <div className="bl-step-title">Generate</div>
                <div className="bl-step-desc">
                  Fill the blanks through the UI or POST to the API. Get a pixel-perfect PNG or
                  JPEG back in seconds.
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CTA strip ────────────────────────────────────────────────── */}
      <section className="bl-cta-strip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bee/beeroniza-bee-mark.png" alt="" width={52} height={52} className="bl-cta-mark" />
        <h2 className="bl-cta-title">Stop paying for services you could just run yourself.</h2>
        <p className="bl-cta-sub">
          Self-hosted, source-available, no per-image fees. Your data, your server, your rules. <span className="bl-emoji">🍺</span>
        </p>
        {allowRegistration ? (
          <Link href="/register" className="btn btn-dark btn-lg">Create your first template</Link>
        ) : (
          <Link href="/login" className="btn btn-dark btn-lg">Sign in</Link>
        )}
      </section>

    </div>
  );
}
