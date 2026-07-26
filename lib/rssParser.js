import Parser from "rss-parser";

const parser = new Parser({
  customFields: {
    item: [["itunes:duration", "duration"]],
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
    })),
  };
}
