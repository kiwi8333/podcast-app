import { safeFetch, readCappedText } from "@/lib/ssrfGuard";

const MAX_TRANSCRIPT_BYTES = 5 * 1024 * 1024;

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  let upstream;
  try {
    upstream = await safeFetch(url);
  } catch {
    res.status(400).json({ error: "Invalid transcript URL" });
    return;
  }

  try {
    if (!upstream.ok) {
      res.status(502).json({ error: "Could not fetch transcript" });
      return;
    }
    const text = await readCappedText(upstream, MAX_TRANSCRIPT_BYTES);
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: "Could not load transcript" });
  }
}
