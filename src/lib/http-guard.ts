import { lookup } from "node:dns/promises";
import { Agent } from "undici";

// Guards server-side fetches of user-supplied URLs (template image_url, webhook
// targets) against SSRF: only http(s) on standard ports, and the resolved host
// must be a public address — never loopback, link-local (incl. cloud metadata
// 169.254.169.254), private, or otherwise reserved ranges.

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443"]);

function ipv4Blocked(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // malformed — treat as unsafe
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18/15
  if (a >= 224) return true; // multicast/reserved 224.0.0.0+
  return false;
}

function ipv6Blocked(ip: string): boolean {
  const addr = ip.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4 address.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]);
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  if (addr.startsWith("fe80")) return true; // link-local
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // unique-local fc00::/7
  if (addr.startsWith("ff")) return true; // multicast
  return false;
}

function ipBlocked(ip: string, family: number): boolean {
  return family === 6 ? ipv6Blocked(ip) : ipv4Blocked(ip);
}

// Validates a URL and resolves its host, rejecting any address that falls in a
// blocked range. Throws on anything unsafe so callers can fail closed.
export async function assertPublicUrl(raw: string): Promise<void> {
  const u = new URL(raw);
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
    throw new Error(`Blocked URL scheme: ${u.protocol}`);
  }
  if (!ALLOWED_PORTS.has(u.port)) {
    throw new Error(`Blocked URL port: ${u.port}`);
  }
  // Resolve ALL addresses the host maps to and require every one to be public
  // (defends against DNS records that return a mix of public + private IPs).
  const results = await lookup(u.hostname, { all: true });
  if (results.length === 0) throw new Error("Host did not resolve");
  for (const { address, family } of results) {
    if (ipBlocked(address, family)) {
      throw new Error(`Blocked host address: ${address}`);
    }
  }
}

export interface SafeImage {
  contentType: string;
  bytes: Buffer;
}

// An undici Agent whose connect.lookup validates the resolved IP at connect time,
// pinning the address and closing the DNS-rebinding TOCTOU gap: the same IP that
// passes the check is the IP the socket actually connects to.
function makeSsrfSafeAgent() {
  return new Agent({
    connect: {
      lookup: (hostname, _opts, callback) => {
        lookup(hostname, { all: true })
          .then((results) => {
            if (results.length === 0) {
              callback(new Error("Host did not resolve"), "", 4);
              return;
            }
            for (const { address, family } of results) {
              if (ipBlocked(address, family)) {
                callback(new Error(`Blocked host address: ${address}`), "", family);
                return;
              }
            }
            const { address, family } = results[0];
            callback(null, address, family);
          })
          .catch((err: Error) => callback(err, "", 4));
      },
    },
  });
}

// Fetches a remote image with SSRF protection, a hard size cap, a timeout, and
// no redirect-following (a redirect could point back at an internal host).
// Returns null on any failure or policy violation.
export async function safeFetchImage(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<SafeImage | null> {
  const maxBytes = opts.maxBytes ?? 15 * 1024 * 1024;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  try {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      // @ts-expect-error — Node.js fetch accepts undici dispatcher
      dispatcher: makeSsrfSafeAgent(),
    });
    if (!res.ok || !res.body) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return { contentType, bytes: Buffer.concat(chunks) };
  } catch {
    return null;
  }
}

// Fetch a webhook delivery target with SSRF protection + timeout. Returns true
// when the POST was delivered (2xx not required — delivery attempt counts).
export async function safePostWebhook(
  url: string,
  body: unknown,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  await assertPublicUrl(url);
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    // @ts-expect-error — Node.js fetch accepts undici dispatcher
    dispatcher: makeSsrfSafeAgent(),
  });
}
