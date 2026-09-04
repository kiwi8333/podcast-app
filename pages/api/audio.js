import { Readable } from "stream";
import { safeFetch } from "@/lib/ssrfGuard";
import { allowRequest } from "@/lib/rateLimit";

export const config = {
  api: {
    responseLimit: false,
  },
};

const AUDIO_TIMEOUT_MS = 30_000;

// Playback issues several ranged requests per episode (start, each seek), so
// this ceiling is deliberately far above what listening costs and only bites
// on scripted abuse. The route streams unbounded bytes on someone else's
// bandwidth bill, so it cannot stay completely unmetered.
const AUDIO_MAX_REQUESTS = 300;

// Headers worth mirroring back from the origin. Content-Range and
// Accept-Ranges are the ones that make seeking work; without them the
// browser can't tell this proxy supports byte ranges and has to refetch the
// whole episode to move the playhead.
//
// content-type is deliberately NOT in this list — see sanitizeContentType.
const PASSTHROUGH_HEADERS = [
  "content-length",
  "content-range",
  "accept-ranges",
  "last-modified",
  "etag",
];

// Echoing the origin's Content-Type verbatim turned this into a same-origin
// HTML sink: /api/audio?url=https://evil.example/x.html served attacker HTML
// under this app's origin, where it could read the app's IndexedDB (saved
// episodes), talk to the push endpoints as the user, and drive the service
// worker. The proxy exists to move audio, so anything that isn't audio is
// served as an opaque download instead of being trusted.
const AUDIO_TYPE = /^(audio|video)\//i;

function sanitizeContentType(raw) {
  const type = (raw || "").split(";")[0].trim().toLowerCase();
  if (AUDIO_TYPE.test(type)) return raw;
  // Some podcast hosts serve enclosures as octet-stream; that is inert, so
  // it is allowed through as-is. Everything else becomes octet-stream too.
  return "application/octet-stream";
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }
  if (!allowRequest(req, res, { max: AUDIO_MAX_REQUESTS })) return;

  // Forward the browser's Range request upstream instead of always pulling
  // from byte 0 — this is what lets the audio element seek, and it stops a
  // scrub from re-downloading the episode.
  const forwarded = {};
  if (req.headers.range) forwarded.range = req.headers.range;
  if (req.headers["if-range"]) forwarded["if-range"] = req.headers["if-range"];

  let upstream;
  try {
    upstream = await safeFetch(url, { timeoutMs: AUDIO_TIMEOUT_MS, headers: forwarded });
  } catch {
    res.status(400).json({ error: "Invalid audio URL" });
    return;
  }

  try {
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: "Could not fetch audio" });
      return;
    }

    for (const name of PASSTHROUGH_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    if (!upstream.headers.get("accept-ranges")) res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", sanitizeContentType(upstream.headers.get("content-type")));
    // nosniff stops the browser from second-guessing the type above; the
    // sandbox/attachment pair means that even if someone navigates straight
    // to this URL the response can never run as a document on this origin.
    // Neither affects <audio src> or fetch() — they apply to navigations.
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "attachment");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");

    // 206 when the origin honoured the range, 200 when it served the whole
    // body — echoing its status is what keeps the two in agreement.
    res.status(upstream.status);

    const stream = Readable.fromWeb(upstream.body);
    // A listener who seeks or skips leaves this response half-read; without
    // this the upstream socket stays open until it times out.
    res.on("close", () => stream.destroy());
    stream.on("error", () => res.destroyed || res.end());
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch audio" });
  }
}
