import Parser from "rss-parser";
import { safeFetch, readCappedText } from "@/lib/ssrfGuard";

const MAX_FEED_BYTES = 10 * 1024 * 1024;

const parser = new Parser({
  customFields: {
    item: [
      ["itunes:duration", "duration"],
      ["podcast:chapters", "chapters"],
      ["podcast:transcript", "transcripts", { keepArray: true }],
    ],
  },
});

// Three separate places treat episodes[0] as the newest episode, and nothing
// was sorting — so a feed published oldest-first (a minority, but they exist)
// would never light up the new-episode badge, because its "newest" guid never
// changed. Sorting only when every item has a parseable date is deliberate:
// with dates missing, the feed's own document order is better information
// than a sort keyed on NaN.
function sortNewestFirst(episodes) {
  const dated = episodes.map((episode, index) => ({ episode, index, time: Date.parse(episode.pubDate) }));
  if (dated.some((d) => Number.isNaN(d.time))) return episodes;
  // index breaks ties so items sharing a timestamp keep their feed order.
  return dated.sort((a, b) => b.time - a.time || a.index - b.index).map((d) => d.episode);
}

// validators carries the caller's cached etag/lastModified. When the feed is
// unchanged the origin answers 304 with no body at all — no megabyte of XML
// over the wire and no parse — which is the whole point of polling this way.
export async function parseFeed(feedUrl, validators = {}) {
  const headers = {};
  if (validators.etag) headers["if-none-match"] = validators.etag;
  if (validators.lastModified) headers["if-modified-since"] = validators.lastModified;

  // Deliberately not parser.parseURL: that does its own request, which
  // neither passes through the SSRF guard nor carries a timeout or a size
  // cap. Fetch it ourselves, then hand the parser a string.
  const response = await safeFetch(feedUrl, { headers });
  if (response.status === 304) {
    await response.body?.cancel().catch(() => {});
    return { notModified: true };
  }
  if (!response.ok) throw new Error("Could not fetch feed");
  const feed = await parser.parseString(await readCappedText(response, MAX_FEED_BYTES));
  return {
    title: feed.title,
    description: feed.description,
    author: feed.itunes?.author || feed.creator || "",
    image: feed.image?.url || feed.itunes?.image,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    episodes: sortNewestFirst(
      feed.items.map((item) => ({
        guid: item.guid || item.link,
        title: item.title,
        pubDate: item.pubDate,
        description: item.contentSnippet || item.content,
        duration: item.duration,
        audioUrl: item.enclosure?.url,
        artwork: item.itunes?.image || null,
        season: item.itunes?.season ? Number(item.itunes.season) : null,
        episodeNumber: item.itunes?.episode ? Number(item.itunes.episode) : null,
        episodeType: item.itunes?.episodeType || null,
        // Podcasting 2.0 tag attributes land under `.$` (xml2js default) —
        // not directly on the parsed node.
        chaptersUrl: item.chapters?.$?.url || null,
        transcripts: (item.transcripts || [])
          .map((t) => ({ url: t.$?.url, type: t.$?.type, language: t.$?.language }))
          .filter((t) => t.url),
      }))
    ),
  };
}
