// The /api/ai/* routes each spend real money on an Anthropic API key that
// lives in the deployment's env, and nothing else in front of them checks
// who's calling — anyone who finds the deployed URL can run up the bill.
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

function clientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded || "").split(",")[0].trim() || req.socket?.remoteAddress;
  return ip || "unknown";
}

// Returns true when the request may proceed. Sends a 429 itself otherwise,
// so callers just `if (!allowRequest(req, res)) return;`.
export function allowRequest(req, res, { max = MAX_REQUESTS, windowMs = WINDOW_MS } = {}) {
  const key = clientKey(req);
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now >= entry.resetAt) {
    // Bound the map so a spray of spoofed X-Forwarded-For values can't grow
    // it without limit — that would be a memory leak wearing a rate
    // limiter's clothes.
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
