import { safeFetch, readCappedText } from "@/lib/ssrfGuard";
import { allowRequest } from "@/lib/rateLimit";
import { normalizeStations } from "@/lib/radio";

// all.api.radio-browser.info is the directory's round-robin entry point; de1
// is a named mirror behind it. Both are tried because the round-robin record
// occasionally points at a mirror that is down, and a single unlucky DNS
// answer would otherwise empty the Radio tab.
const MIRRORS = [
  "https://all.api.radio-browser.info",
  "https://de1.api.radio-browser.info",
];

const COUNTRY_CODE = "GH";
const REQUEST_TIMEOUT_MS = 8_000;
// The Ghana response is ~125KB today. The cap is what stops an upstream
// change (or a different country code) from buffering something far larger
// into the function's memory.
const MAX_BYTES = 4_000_000;
// Cheaper than the AI routes and cached hard at the edge, but still an
// outbound call on someone else's directory, so it gets a bucket of its own.
const MAX_REQUESTS = 30;

// The directory asks callers to identify themselves so it can contact
// operators about misbehaving clients; an anonymous UA is what gets blocked.
const USER_AGENT = "podcast-app/0.1 (github.com/kiwi8333/podcast-app)";

function directoryUrl(origin) {
  const params = new URLSearchParams({
    hidebroken: "true",
    order: "votes",
    reverse: "true",
  });
  return `${origin}/json/stations/bycountrycodeexact/${COUNTRY_CODE}?${params}`;
}

export default async function handler(req, res) {
  if (!allowRequest(req, res, { max: MAX_REQUESTS })) return;

  let lastError = null;

  for (const origin of MIRRORS) {
    try {
      // safeFetch rather than fetch: these are fixed, trusted origins, but it
      // is also what re-validates each redirect hop, and the directory does
      // redirect between mirrors.
      const upstream = await safeFetch(directoryUrl(origin), {
        timeoutMs: REQUEST_TIMEOUT_MS,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });

      if (!upstream.ok) {
        lastError = new Error(`${origin} returned ${upstream.status}`);
        continue;
      }

      const body = await readCappedText(upstream, MAX_BYTES);
      const stations = normalizeStations(JSON.parse(body));

      // An empty list from a mirror that answered is more likely a bad mirror
      // than a country with no stations, so fall through and try the next one
      // rather than caching an empty tab for an hour.
      if (stations.length === 0) {
        lastError = new Error(`${origin} returned no usable stations`);
        continue;
      }

      // Station line-ups change on the order of weeks. Caching at the edge is
      // what keeps this from hitting a volunteer-run directory once per visit.
      res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
      res.status(200).json({ stations });
      return;
    } catch (err) {
      lastError = err;
    }
  }

  console.error("radio: every mirror failed", lastError);
  res.status(502).json({ error: "Could not load radio stations right now" });
}
