// The /api/ai/* routes each spend real money on an Anthropic API key that
// lives in the deployment's env, and nothing else in front of them checks
// who's calling — anyone who finds the deployed URL can run up the bill.
// The proxy routes cost bandwidth rather than tokens, but the same applies.
// A fixed window per client IP is the cheap floor.
//
// Deliberately in-memory: this app has no datastore, and the alternative
// (pulling in Redis) is a bigger change than the problem warrants. The
// tradeoff is real and worth knowing — each serverless instance keeps its
// own counter, so the effective limit is per-instance, not global. It stops
// a casual scraper, not a determined distributed one. Move the bucket to a
// shared store if these routes ever face real abuse.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_TRACKED_CLIENTS = 5000;

const hits = new Map(); // clientKey -> { count, resetAt }

// Header order matters for correctness, not just preference. Both
// x-forwarded-for and x-real-ip are client-supplied on the way in: a caller
// can send their own, and unless something in front of this app overwrites
// them, whatever they typed is what lands here. Keying on that lets one
// attacker mint a fresh bucket per request and walk straight through the
// limiter — which is exactly what a spoofing probe against this route
// showed before this was reordered.
//
// x-vercel-forwarded-for is set by the platform and cannot be spoofed from
// outside, so it is the only forwarding header trusted by default. On any
// other host the socket address is used instead; set TRUST_PROXY_HEADERS=1
// only when a proxy you control is guaranteed to overwrite these headers.
function clientKey(req) {
  const first = (value) => {
    const raw = Array.isArray(value) ? value[0] : value;
    return (raw || "").split(",")[0].trim();
  };

  const vercel = first(req.headers["x-vercel-forwarded-for"]);
  if (vercel) return vercel;

  if (process.env.TRUST_PROXY_HEADERS === "1") {
    const forwarded = first(req.headers["x-real-ip"]) || first(req.headers["x-forwarded-for"]);
    if (forwarded) return forwarded;
  }

  return req.socket?.remoteAddress || "unknown";
}

// Returns true when the request may proceed. Sends a 429 itself otherwise,
// so callers just `if (!allowRequest(req, res)) return;`.
export function allowRequest(req, res, { max = MAX_REQUESTS, windowMs = WINDOW_MS } = {}) {
  // Separate buckets per limit, so a generous allowance on one route (audio
  // playback issues many ranged requests) doesn't spend a strict route's
  // budget for the same visitor.
  const key = `${max}:${clientKey(req)}`;
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now >= entry.resetAt) {
    // Bound the map so a spray of spoofed forwarding headers can't grow it
    // without limit — that would be a memory leak wearing a rate limiter's
    // clothes.
    if (hits.size >= MAX_TRACKED_CLIENTS) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
      if (hits.size >= MAX_TRACKED_CLIENTS) hits.clear();
    }
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) {
    res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
    res.status(429).json({ error: "Too many requests — try again shortly." });
    return false;
  }

  entry.count += 1;
  return true;
}
