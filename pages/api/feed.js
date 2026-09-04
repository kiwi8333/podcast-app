import { parseFeed } from "@/lib/rssParser";

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    // Pass the caller's cached validators through to the origin. When the
    // feed hasn't changed we get a 304 with no body — no XML transferred and
    // nothing to parse — and hand that straight back to the client.
    const feed = await parseFeed(url, {
      etag: req.headers["if-none-match"],
      lastModified: req.headers["if-modified-since"],
    });

    if (feed.notModified) {
      res.status(304).end();
      return;
    }

    // Podcast feeds update on the order of days, and re-fetching plus
    // re-parsing a large RSS document on every page view is the single
    // most expensive thing this app does per request.
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    if (feed.etag) res.setHeader("ETag", feed.etag);
    if (feed.lastModified) res.setHeader("Last-Modified", feed.lastModified);
    res.status(200).json(feed);
  } catch (err) {
    res.status(500).json({ error: "Could not load that podcast feed" });
  }
}
