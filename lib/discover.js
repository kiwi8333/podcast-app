import { searchPodcasts } from "./itunes";

function normalizeFeedUrl(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export async function fetchCategoryPodcasts(category, limit = 20) {
  const resultsByTerm = await Promise.all(
    category.searchTerms.map((term) => searchPodcasts(term).catch(() => []))
  );

  const seen = new Set();
  const merged = [];
  for (const results of resultsByTerm) {
    for (const podcast of results) {
      const key = normalizeFeedUrl(podcast.feedUrl);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(podcast);
      if (merged.length >= limit) return merged;
    }
  }
  return merged;
}
