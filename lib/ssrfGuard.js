import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIPv4(ip) {
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  // IETF protocol assignments (192.0.0.0/24) and the benchmarking range
  // (198.18.0.0/15) are not routable on the public internet either, so a
  // host resolving into one is not a podcast host.
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(lower)) return true; // unique local fc00::/7
  // 6to4 (2002::/16) and NAT64 (64:ff9b::/96) both embed an IPv4 address;
  // left alone they are a way to spell a private v4 target in v6.
  if (lower.startsWith("2002:") || lower.startsWith("64:ff9b:")) return true;

  // IPv4-mapped addresses have two spellings — ::ffff:127.0.0.1 and the
  // fully expanded 0:0:0:0:0:ffff:7f00:1. Matching only the first left the
  // second reading as an ordinary public v6 address.
  const mapped = lower.match(/^(?:0*:)*0*ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    if (net.isIPv4(tail)) return isPrivateIPv4(tail);
    // Hex form: ffff:7f00:1 — rebuild the dotted quad from the last 32 bits.
    const groups = tail.split(":").filter(Boolean);
    if (groups.length === 2 && groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) {
      const [high, low] = groups.map((g) => parseInt(g, 16));
      const quad = [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
      return isPrivateIPv4(quad);
    }
    return true; // ffff-prefixed but unparseable — fail closed
  }
  return false;
}

function isPrivateIP(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unrecognized format — fail closed
}

// Blocks requests to loopback/private/link-local/metadata addresses so these
// routes can't be used to reach internal network services (SSRF). Checks the
// resolved DNS address, not just the literal hostname, since a public-looking
// hostname can still resolve to a private IP.
export async function assertPublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  // http://expected-host@internal/ reads as the expected host to a human
  // skimming a feed, but the browser and fetch both connect to `internal`.
  // Nothing legitimate puts credentials in a podcast URL.
  if (parsed.username || parsed.password) {
    throw new Error("Credentials in the URL are not allowed");
  }

  const hostname = parsed.hostname;

  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new Error("This host is not allowed");
    return parsed;
  }

  // Bracketed IPv6 literals arrive from URL.hostname still wrapped.
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const inner = hostname.slice(1, -1);
    if (isPrivateIP(inner)) throw new Error("This host is not allowed");
    return parsed;
  }

  if (hostname.toLowerCase() === "localhost" || hostname.toLowerCase().endsWith(".localhost")) {
    throw new Error("This host is not allowed");
  }

  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0 || records.some((r) => isPrivateIP(r.address))) {
    throw new Error("This host is not allowed");
  }

  return parsed;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

// assertPublicHttpUrl only vets the URL you hand it — but `fetch` follows
// redirects by default, so a feed on a perfectly public domain could 302 to
// 169.254.169.254 and the guard would never see it. (Verified: the guard
// blocked the direct URL and fetch still walked the redirect to a loopback
// service.) This follows redirects manually and re-validates every hop.
//
// Residual risk this does NOT close: the DNS lookup here and the one fetch
// does when it connects are separate resolutions, so a record that changes
// between them (DNS rebinding) still gets through. Closing that needs a
// custom agent that validates the socket's peer address on connect.
export async function safeFetch(rawUrl, { timeoutMs = DEFAULT_TIMEOUT_MS, headers, method = "GET" } = {}) {
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = await assertPublicHttpUrl(currentUrl);
    const response = await fetch(parsed.toString(), {
      method,
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    const location = response.headers.get("location");
    const isRedirect = response.status >= 300 && response.status < 400 && location;
    if (!isRedirect) return response;

    // Resolve relative Locations against the hop we actually fetched, and
    // release the redirect body rather than leaking the socket.
    currentUrl = new URL(location, parsed).toString();
    await response.body?.cancel().catch(() => {});
  }

  throw new Error("Too many redirects");
}

// Upstreams are untrusted: `.text()`/`.json()` would happily buffer a
// multi-gigabyte body into the function's memory. Stops at the cap instead.
export async function readCappedText(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Response too large");

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error("Response too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
