import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="landing">
      <nav className="landing-nav">
        <span className="bnz-brand">Beeroniza</span>
        <div className="d-flex gap-2">
          <Link href="/login" className="btn btn-outline-secondary btn-sm">
            Sign in
          </Link>
          <Link href="/register" className="btn btn-primary btn-sm">
            Get started
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <h1 className="display-4 fw-bold mb-3">
          Generate social &amp; OpenGraph banners — on your own terms.
        </h1>
        <p className="lead text-secondary mb-4">
          Design a template once, then create unlimited images from it: in the
          browser or via a simple REST API. Self-hosted, privacy-first, and free
          to run on your own infrastructure.
        </p>
        <div className="d-flex gap-3 justify-content-center flex-wrap">
          <Link href="/register" className="btn btn-primary btn-lg">
            Create your first template
          </Link>
          <Link href="/login" className="btn btn-outline-dark btn-lg">
            Sign in
          </Link>
        </div>
      </section>

      <section className="landing-features">
        <div className="feature">
          <h3 className="h5">Visual editor</h3>
          <p className="text-secondary mb-0">
            Place text, images and shapes. Mark layers as placeholders to fill
            per generation. Smart alignment guides included.
          </p>
        </div>
        <div className="feature">
          <h3 className="h5">REST API</h3>
          <p className="text-secondary mb-0">
            Generate images programmatically with API keys. Asynchronous by
            design — submit a job, poll or receive a webhook.
          </p>
        </div>
        <div className="feature">
          <h3 className="h5">Privacy by default</h3>
          <p className="text-secondary mb-0">
            No external services, no CDN. Your content and fonts never leave
            your server. One Postgres database runs everything.
          </p>
        </div>
      </section>
    </main>
  );
}
