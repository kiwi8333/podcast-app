// Ghanaian live radio, sourced from the Radio Browser community directory
// (https://api.radio-browser.info). It is free, needs no key, and is the only
// openly available register of Ghanaian stream URLs — the alternative was
// hardcoding a list this repo would have no way to keep current, and a dead
// stream URL is indistinguishable from a broken app to whoever taps it.
//
// The tradeoff is that the data is community-edited: names are inconsistently
// cased, the same station gets submitted more than once, and a handful of
// entries are not Ghanaian at all. Everything below exists to make that
// usable rather than to pretend it is clean.

const DEFAULT_LIMIT = 60;

// Streams must be https. The app is served over https, so an http:// stream
// is blocked as mixed content — the <audio> element fails silently and the
// station simply never starts. Filtering here is what keeps a station from
// appearing in the list at all rather than appearing and being unplayable.
// This drops roughly one in seven entries and none of the major stations.
function readStreamUrl(entry) {
  const raw = entry.url_resolved || entry.url || "";
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  return raw;
}

function readTags(entry) {
  return String(entry.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeStation(entry) {
  if (!entry || typeof entry !== "object") return null;

  const name = String(entry.name || "").trim();
  if (!name) return null;

  // lastcheckok is the directory's own periodic reachability probe. Entries
  // failing it are stations that have moved or shut down, which is most of
  // what makes a community radio list feel broken.
  if (entry.lastcheckok !== 1) return null;

  const streamUrl = readStreamUrl(entry);
  if (!streamUrl) return null;

  const bitrate = Number(entry.bitrate);
  const votes = Number(entry.votes);

  return {
    id: String(entry.stationuuid || streamUrl),
    name,
    streamUrl,
    homepage: String(entry.homepage || "") || null,
    // Station logos are hotlinked from whatever the submitter entered, so
    // they 404 more often than podcast artwork does. The row falls back to an
    // icon; nothing here depends on the image loading.
    logo: String(entry.favicon || "") || null,
    codec: String(entry.codec || "").toUpperCase() || null,
    // 0 is what the directory stores when the bitrate was never measured,
    // which is not the same as a 0kbps stream and should not be shown.
    bitrate: Number.isFinite(bitrate) && bitrate > 0 ? bitrate : null,
    language: String(entry.language || "").trim() || null,
    tags: readTags(entry),
    votes: Number.isFinite(votes) ? votes : 0,
  };
}

// Sorting before de-duplicating is deliberate: the directory holds "citi fm"
// with 4,714 votes and "Citi FM" with 51, pointing at the same stream. Sorting
// first means the popular spelling is the one that survives, rather than
// whichever the API happened to return first.
export function normalizeStations(raw, { limit = DEFAULT_LIMIT } = {}) {
  if (!Array.isArray(raw)) return [];

  const stations = raw
    .map(normalizeStation)
    .filter(Boolean)
    .sort((a, b) => b.votes - a.votes);

  const seenUrl = new Set();
  const seenName = new Set();
  const unique = [];

  for (const station of stations) {
    // Trailing slashes and casing differ between duplicate submissions of the
    // same stream, so compare a normalized form rather than the raw string.
    const urlKey = station.streamUrl.toLowerCase().replace(/\/+$/, "");
    const nameKey = station.name.toLowerCase().replace(/\s+/g, " ");
    if (seenUrl.has(urlKey) || seenName.has(nameKey)) continue;
    seenUrl.add(urlKey);
    seenName.add(nameKey);
    unique.push(station);
    if (unique.length >= limit) break;
  }

  return unique;
}

export async function fetchStations({ signal } = {}) {
  const res = await fetch("/api/radio", { signal });
  if (!res.ok) throw new Error("Could not load radio stations");
  const data = await res.json();
  return Array.isArray(data.stations) ? data.stations : [];
}

// Matches on name, tags and language together so that "twi", "news" and "joy"
// all find something without needing a separate filter control for each.
export function filterStations(stations, query) {
  const term = query.trim().toLowerCase();
  if (!term) return stations;
  return stations.filter((station) => {
    const haystack = [station.name, station.language, ...station.tags]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });
}
