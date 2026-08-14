import { assertPublicHttpUrl } from "@/lib/ssrfGuard";

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    await assertPublicHttpUrl(url);
  } catch {
    res.status(400).json({ error: "Invalid transcript URL" });
    return;
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(502).json({ error: "Could not fetch transcript" });
      return;
    }
    const text = await upstream.text();
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: "Could not load transcript" });
  }
}
