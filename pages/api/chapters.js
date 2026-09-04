import { safeFetch, readCappedText } from "@/lib/ssrfGuard";
import { allowRequest } from "@/lib/rateLimit";

const PROXY_MAX_REQUESTS = 60;
const MAX_CHAPTERS_BYTES = 1 * 1024 * 1024;

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }
  // An open URL proxy. Generous enough that browsing never notices, low
  // enough that nobody runs a scraper through this deployment for free.
  if (!allowRequest(req, res, { max: PROXY_MAX_REQUESTS })) return;

  let upstream;
  try {
    upstream = await safeFetch(url);
  } catch {
    res.status(400).json({ error: "Invalid chapters URL" });
    return;
  }

  try {
    if (!upstream.ok) {
      res.status(502).json({ error: "Could not fetch chapters" });
      return;
    }
    // Read capped, then parse — response.json() would buffer the whole body
    // before we ever got to check its size.
    const data = JSON.parse(await readCappedText(upstream, MAX_CHAPTERS_BYTES));
    if (!Array.isArray(data.chapters)) {
      res.status(502).json({ error: "Chapters file has an unexpected shape" });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Could not load chapters" });
  }
}
