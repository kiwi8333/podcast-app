import { Readable } from "stream";
import { safeFetch } from "@/lib/ssrfGuard";

export const config = {
  api: {
    responseLimit: false,
  },
};

const AUDIO_TIMEOUT_MS = 30_000;

// Headers worth mirroring back from the origin. Content-Range and
// Accept-Ranges are the ones that make seeking work; without them the
// browser can't tell this proxy supports byte ranges and has to refetch the
// whole episode to move the playhead.
const PASSTHROUGH_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "last-modified",
  "etag",
];

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

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
    if (!upstream.headers.get("content-type")) res.setHeader("Content-Type", "audio/mpeg");

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
