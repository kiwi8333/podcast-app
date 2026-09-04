import { allowRequest } from "@/lib/rateLimit";

const SEARCH_MAX_REQUESTS = 60;
const MAX_TERM_LENGTH = 200;

export default async function handler(req, res) {
  const { term } = req.query;

  if (typeof term !== "string" || !term) {
    res.status(400).json({ error: "Missing term parameter" });
    return;
  }
  if (term.length > MAX_TERM_LENGTH) {
    res.status(400).json({ error: "Search term is too long" });
    return;
  }
  // Every call here is a request made to iTunes in this deployment's name.
  if (!allowRequest(req, res, { max: SEARCH_MAX_REQUESTS })) return;

  try {
    const url = `https://itunes.apple.com/search?media=podcast&limit=25&term=${encodeURIComponent(
      term
    )}`;
    // Without a timeout a slow iTunes response pins this function until the
    // platform kills it, and the user just sees a spinner.
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      res.status(502).json({ error: "Search request failed" });
      return;
    }

    const data = await response.json();
    // iTunes is an upstream, not a contract — an unexpected shape here used
    // to throw inside the try and surface as a 500.
    const results = (Array.isArray(data.results) ? data.results : [])
      .filter((item) => item.feedUrl)
      .map((item) => ({
        id: item.collectionId,
        title: item.collectionName,
        artist: item.artistName,
        artwork: item.artworkUrl600 || item.artworkUrl100,
        feedUrl: item.feedUrl,
      }));

    // Search results are the same for everyone and change slowly; without
    // this every keystroke that reaches the server re-hits iTunes.
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: "Search request failed" });
  }
}
