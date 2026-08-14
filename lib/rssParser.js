import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: [
      ["itunes:duration", "duration"],
      ["podcast:chapters", "chapters"],
      ["podcast:transcript", "transcripts", { keepArray: true }],
    ],
  },
});

export async function parseFeed(feedUrl) {
  const feed = await parser.parseURL(feedUrl);
  return {
    title: feed.title,
    description: feed.description,
    author: feed.itunes?.author || feed.creator || "",
    image: feed.image?.url || feed.itunes?.image,
    episodes: feed.items.map((item) => ({
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
    })),
  };
}
