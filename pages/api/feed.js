import { parseFeed } from "@/lib/rssParser";

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    const feed = await parseFeed(url);
    res.status(200).json(feed);
  } catch (err) {
    res.status(500).json({ error: "Could not load that podcast feed" });
  }
}
