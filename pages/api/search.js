export default async function handler(req, res) {
  const { term } = req.query;

  if (!term) {
    res.status(400).json({ error: "Missing term parameter" });
    return;
  }

  try {
    const url = `https://itunes.apple.com/search?media=podcast&limit=25&term=${encodeURIComponent(
      term
    )}`;
    const response = await fetch(url);
    if (!response.ok) {
      res.status(502).json({ error: "Search request failed" });
      return;
    }

    const data = await response.json();
    const results = data.results
      .filter((item) => item.feedUrl)
      .map((item) => ({
        id: item.collectionId,
        title: item.collectionName,
        artist: item.artistName,
        artwork: item.artworkUrl600 || item.artworkUrl100,
        feedUrl: item.feedUrl,
      }));

    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: "Search request failed" });
  }
}
