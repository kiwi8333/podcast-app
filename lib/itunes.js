export async function searchPodcasts(term) {
  const url = `https://itunes.apple.com/search?media=podcast&limit=25&term=${encodeURIComponent(
    term
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Search request failed");
  }
  const data = await res.json();
  return data.results
    .filter((item) => item.feedUrl)
    .map((item) => ({
      id: item.collectionId,
      title: item.collectionName,
      artist: item.artistName,
      artwork: item.artworkUrl600 || item.artworkUrl100,
      feedUrl: item.feedUrl,
    }));
}
