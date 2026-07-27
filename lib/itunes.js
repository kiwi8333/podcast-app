export async function searchPodcasts(term) {
  const res = await fetch(`/api/search?term=${encodeURIComponent(term)}`);
  if (!res.ok) {
    throw new Error("Search request failed");
  }
  const data = await res.json();
  return data.results;
}
