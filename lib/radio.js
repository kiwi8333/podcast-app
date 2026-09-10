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

// The directory is queried by country code, but that code is community-set
// and demonstrably wrong for some entries: the Ghana listing carries a
// Croatian station (057 radio, .hr), an Arabic Quran channel, a Tamil
// Christian station (Amen FM) and two lo-fi music streams. A country tag is
// therefore treated as a candidate, not as proof, and every station has to
// show at least one piece of Ghanaian evidence below to be listed.

// Languages specific to Ghana. Hausa is deliberately absent — it is spoken in
// northern Ghana but far more widely in Nigeria and Niger, so on its own it
// is not evidence of a Ghanaian station. (Zuria FM, the one Hausa station
// here, still qualifies on its streaming host.)
const GH_LANGUAGES = [
  "akan", "twi", "ewe", "ga", "dagbani", "fante", "fanti",
  "nzema", "dagaare", "gonja", "frafra", "kasem",
];

// Matched as plain substrings. "ghana" in particular has to match inside a
// compound: modernghana.com, livefmghana.com and chinaghana.com are all real
// Ghanaian stations whose only signal is the domain, and a word-boundary rule
// rejected all three — including one with 1,666 votes. Every name here is
// distinctive enough not to turn up inside an unrelated word.
const GH_PLACES = [
  "ghana", "accra", "kumasi", "takoradi", "tamale", "cape coast", "tarkwa",
  "sekondi", "koforidua", "sunyani", "bolgatanga", "obuasi", "ashanti",
  "techiman", "kyebi", "upper west", "upper east", "kasoa", "madina",
];

// Short enough to appear inside unrelated words — "tema" sits inside
// "Asenteman" — so these are the ones that do need a boundary.
const GH_PLACES_WORD = ["tema"];

// Streaming hosts that carry only Ghanaian broadcasters. Checked against the
// full listing: mmg = Multimedia Group Ghana (Joy, Adom, Hitz, Luv, Nhyira,
// Asempa), atunwadigital = Atunwa Digital (Peace, Happy, Hello, YFM, Oman,
// Agoo, Opemsuo, Zuria, Lawson), mediagh = GBC Uniiq, plus Citi 97.3 Accra
// and ATL FM Cape Coast on their own subdomains.
//
// Matched as a substring because the station name is prefixed with a hyphen,
// not a dot — "lawsonfm963-atunwadigital.streamguys1.com". Matching on a dot
// boundary dropped Lawson Radio, which is a real station in Ghana.
const GH_STREAM_HOSTS = [
  "mmg.streamguys1.com",
  "atunwadigital.streamguys1.com",
  "mediagh.us",
  "citi973fm.radioca.st",
  "atlfm1005.radioca.st",
];

// Stations that are genuinely Ghanaian but carry none of the signals above:
// no Ghanaian language tag, no place name, and a generic streaming host.
// Each was confirmed by reading the station's own homepage, and that is the
// only reason any of them is here — this list vouches for them, so it stays
// short and nothing goes in unverified.
//
//   oroko.live               "Oroko" — community radio broadcasting from Accra
//   sankofaradio.com         "Sankofa Radio - Breaking News, Ghana, Africa"
//   rainbowradioonline.com   "Rainbow Radio Accra and London"
//
// Deliberately NOT here, having failed the same check: torqradio.com,
// 360africahitz.com, westendfmonline.com, boxradio.net, afronation.com and
// amenfm.com (a Tamil Christian station).
const GH_HOMEPAGES = ["oroko.live", "sankofaradio.com", "rainbowradioonline.com"];

// Only used for the short needles above, all of which are plain lowercase
// words, so there is nothing here to escape.
const wordBoundary = (needle) => new RegExp(`(^|[^a-z])${needle}($|[^a-z])`, "i");

function homepageHost(homepage) {
  try {
    return new URL(homepage).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function streamHost(entry) {
  try {
    return new URL(entry.url_resolved || entry.url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// Returns the reason a station counts as Ghanaian, or null. Returning the
// reason rather than a boolean is what makes the filter auditable — the
// tests assert on which signal fired, so a station passing for the wrong
// reason is a visible failure rather than a silent one.
export function ghanaEvidence(entry) {
  const languages = String(entry.language || "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  if (languages.some((language) => GH_LANGUAGES.includes(language))) return "language";

  const text = [entry.name, entry.tags, entry.homepage].filter(Boolean).join(" ");
  const lowerText = text.toLowerCase();
  if (GH_PLACES.some((place) => lowerText.includes(place))) return "place";
  if (GH_PLACES_WORD.some((place) => wordBoundary(place).test(text))) return "place";

  // A .gh domain, or a name that says GH outright ("Infinity Radio GH").
  if (/\.gh(\b|\/)/i.test(text) || wordBoundary("gh").test(String(entry.name || ""))) return "domain";

  const host = streamHost(entry);
  if (GH_STREAM_HOSTS.some((known) => host.includes(known))) return "stream-host";

  if (GH_HOMEPAGES.includes(homepageHost(entry.homepage))) return "verified-homepage";

  return null;
}

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

  // The country code got this entry into the candidate pool; this is what
  // decides whether it is actually a Ghanaian station.
  const evidence = ghanaEvidence(entry);
  if (!evidence) return null;

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
    // Which signal qualified this station. Not shown in the UI; it is here so
    // the listing can be audited without re-deriving it.
    evidence,
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
