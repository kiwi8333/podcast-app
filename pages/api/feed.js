import { parseFeed } from "@/lib/rssParser";

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    // parseFeed now fetches through the SSRF guard itself (with a timeout and
    // a size cap), so there's no separate assertPublicHttpUrl call here — a
    // second one would just re-resolve the same hostname.
    const feed = await parseFeed(url);
    // Podcast feeds update on the order of days, and re-fetching plus
    // re-parsing a large RSS document on every page view is the single
    // most expensive thing this app does per request.
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    res.status(200).json(feed);
  } catch (err) {
    res.status(500).json({ error: "Could not load that podcast feed" });
  }
}
