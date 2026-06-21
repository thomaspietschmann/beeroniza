import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

// Block external access to /internal/* routes (e.g. the render bridge, which
// would otherwise let anyone drive the headless renderer). The only legitimate
// caller is the in-process render worker, which reaches the route over loopback
// and carries a shared-secret header derived from AUTH_SECRET.
//
// We do NOT gate on the client IP / x-forwarded-for: a reverse proxy such as
// Traefik APPENDS to the forwarded chain, so a client-supplied
// "X-Forwarded-For: 127.0.0.1" would survive as the left-most entry and defeat
// an IP check. A secret the external world cannot know is spoof-proof; Traefik
// forwards the header verbatim but an attacker has no way to guess AUTH_SECRET.
export function proxy(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? "";
  const provided = req.headers.get("x-bnz-internal-render") ?? "";
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);
  const match =
    secret.length > 0 &&
    secretBuf.length === providedBuf.length &&
    timingSafeEqual(secretBuf, providedBuf);
  if (!match) {
    return new NextResponse(null, { status: 404 });
  }
}

export const config = {
  matcher: ["/internal/:path*"],
};
