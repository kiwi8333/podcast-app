import { put, get, BlobPreconditionFailedError } from "@vercel/blob";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// One small JSON document holds both the push subscriptions and the per-feed
// polling state. This is a personal-scale app, so a single document is fine —
// but the send cron and someone hitting subscribe/unsubscribe can still race:
// both read the whole thing, both write a full copy back, and the second
// write silently erases the first. A conditional write (ifMatch on the ETag)
// makes a lost race fail loudly instead.
const PATHNAME = "podcast-push.json";
const MAX_ATTEMPTS = 5;

export { BlobPreconditionFailedError };

const EMPTY = { subscriptions: [], feeds: {} };

// Vercel Blob in production; a local file in development. The fallback exists
// so the whole push path — subscribe, cron, delivery — can be exercised on
// localhost without provisioning a Blob store first, which otherwise leaves
// notification delivery as the one thing nobody can test until after deploy.
//
// Production without a token throws rather than quietly using the filesystem:
// a serverless function's disk is per-invocation and not shared, so a silent
// fallback there would look like it worked and then lose every subscription.
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const DEV_FILE = path.join(process.cwd(), ".push-dev", "state.json");

// The fallback is opt-in via PUSH_DEV_STORE=1 as well as by NODE_ENV, because
// `next start` runs with NODE_ENV=production even on a laptop — testing the
// real production code path locally would otherwise be impossible. A real
// deployment never sets PUSH_DEV_STORE, so it still gets the loud failure.
const allowDevStore = process.env.PUSH_DEV_STORE === "1" || process.env.NODE_ENV !== "production";

function assertConfigured() {
  if (useBlob || allowDevStore) return;
  throw new Error(
    "Push storage is not configured: set BLOB_READ_WRITE_TOKEN. The filesystem " +
      "fallback is development-only (PUSH_DEV_STORE=1) — serverless instances do not share a disk, " +
      "so using it in production would silently lose every subscription."
  );
}

function normalize(parsed) {
  return {
    subscriptions: Array.isArray(parsed?.subscriptions) ? parsed.subscriptions : [],
    feeds: parsed?.feeds && typeof parsed.feeds === "object" ? parsed.feeds : {},
  };
}

// Hashing the content gives the dev backend the same compare-and-swap
// semantics the Blob ETag provides, so the retry path is exercised locally
// rather than only in production.
const hash = (text) => crypto.createHash("sha1").update(text).digest("hex");

async function readDev() {
  try {
    const text = await fs.readFile(DEV_FILE, "utf8");
    return { state: normalize(JSON.parse(text)), etag: hash(text) };
  } catch {
    return { state: structuredClone(EMPTY), etag: null };
  }
}

async function writeDev(state, etag) {
  let currentEtag = null;
  try {
    currentEtag = hash(await fs.readFile(DEV_FILE, "utf8"));
  } catch {
    // no file yet — treated as etag null, same as a first write
  }
  if (etag !== currentEtag) throw new Error("precondition-failed");
  await fs.mkdir(path.dirname(DEV_FILE), { recursive: true });
  await fs.writeFile(DEV_FILE, JSON.stringify(state, null, 2), "utf8");
}

// useCache:false is load-bearing. Blob reads are served from CDN cache by
// default and can be up to ~60s stale — a stale read hands back a stale ETag
// too, so a retry after a lost race keeps re-reading the same stale snapshot
// instead of genuinely fresh state.
export async function readState() {
  assertConfigured();
  if (!useBlob) return readDev();

  const result = await get(PATHNAME, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return { state: structuredClone(EMPTY), etag: null };
  const parsed = await new Response(result.stream).json();
  // get() returns a *weak* ETag (W/"..."), but put()'s ifMatch compares
  // against the strong form. Passing the weak one straight through makes
  // every conditional write fail, valid or not. The hash is the same.
  return { state: normalize(parsed), etag: result.blob.etag.replace(/^W\//, "") };
}

export async function writeState(state, etag) {
  assertConfigured();
  if (!useBlob) return writeDev(state, etag);

  await put(PATHNAME, JSON.stringify(state), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    ifMatch: etag ?? undefined,
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Read, apply a pure mutate(state) -> state, write back; retry against fresh
// state if a concurrent writer won. Only safe for mutations with no side
// effects — subscribe/unsubscribe qualify, sending pushes does not (send.js
// reads and writes directly, because a retry there would re-send
// notifications people already received).
//
// Retries on ANY write failure, not just BlobPreconditionFailedError: under
// genuine concurrency the store can also reject a conditional write with a
// plain BlobError ("conflicting operation") that is not an instance of that
// class, and matching only the specific class lets those through as hard
// failures. The jittered delay stops concurrent callers re-colliding in
// lockstep.
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
