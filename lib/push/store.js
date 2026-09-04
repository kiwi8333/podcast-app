import { put, get, BlobPreconditionFailedError } from "@vercel/blob";

// One small JSON blob holds both the push subscriptions and the per-feed
// polling state. This is a personal-scale app, so a single blob is fine —
// but the send cron and someone hitting subscribe/unsubscribe can still
// race: both read the whole document, both write a full copy back, and the
// second write silently erases the first. ifMatch makes the write
// conditional on the ETag, so a lost race fails loudly instead.
//
// The three non-obvious details below were learned the hard way against the
// real store in this author's other app; they are not theoretical.
const PATHNAME = "podcast-push.json";
const MAX_ATTEMPTS = 5;

export { BlobPreconditionFailedError };

const EMPTY = { subscriptions: [], feeds: {} };

// useCache:false is load-bearing. Blob reads are served from CDN cache by
// default and can be up to ~60s stale — a stale read hands back a stale
// ETag too, so a retry after a lost race would keep re-reading the same
// stale snapshot instead of genuinely fresh state.
export async function readState() {
  const result = await get(PATHNAME, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return { state: structuredClone(EMPTY), etag: null };
  const parsed = await new Response(result.stream).json();
  const state = {
    subscriptions: Array.isArray(parsed?.subscriptions) ? parsed.subscriptions : [],
    feeds: parsed?.feeds && typeof parsed.feeds === "object" ? parsed.feeds : {},
  };
  // get() returns a *weak* ETag (W/"..."), but put()'s ifMatch compares
  // against the strong form. Passing the weak one straight through makes
  // every conditional write fail, valid or not. The hash is the same.
  return { state, etag: result.blob.etag.replace(/^W\//, "") };
}

export async function writeState(state, etag) {
  await put(PATHNAME, JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    ifMatch: etag ?? undefined,
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Read, apply a pure mutate(state) -> state, write back; retry against
// fresh state if a concurrent writer won. Only safe for mutations with no
// side effects — subscribe/unsubscribe qualify, sending pushes does not
// (send.js reads and writes directly, because a retry there would re-send
// notifications people have already received).
//
// Retries on ANY write failure, not just BlobPreconditionFailedError:
// under genuine concurrency the store can also reject a conditional write
// with a plain BlobError ("conflicting operation") that is not an instance
// of that class, and matching only the specific class lets those through
// as hard failures. The jittered delay stops concurrent callers
// re-colliding in lockstep.
export async function updateState(mutate) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { state, etag } = await readState();
    const next = mutate(state);
    try {
      await writeState(next, etag);
      return next;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await sleep(30 * attempt + Math.random() * 50);
    }
  }
  throw lastError;
}
