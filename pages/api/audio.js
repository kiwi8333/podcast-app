import { Readable } from "stream";

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      res.status(502).json({ error: "Could not fetch audio" });
      return;
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch audio" });
  }
}
