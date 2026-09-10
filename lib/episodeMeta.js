// Formatting for the episode cards. Pure and separate from the component so
// the awkward cases — and feeds are full of them — can be tested directly.

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

// itunes:duration is specified as HH:MM:SS but is honoured loosely: feeds in
// the wild send "3600", "28:31", "01:02:03", and occasionally empty strings
// or nonsense. Anything that doesn't parse returns null and the card simply
// omits the duration rather than printing "NaN min".
export function parseDuration(raw) {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return seconds > 0 ? seconds : null;
  }

  if (!/^\d{1,3}(:[0-5]?\d){1,2}$/.test(value)) return null;

  const seconds = value
    .split(":")
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);

  return seconds > 0 ? seconds : null;
}

export function formatDuration(raw) {
  const seconds = parseDuration(raw);
  if (seconds === null) return null;

  if (seconds < SECONDS_PER_HOUR) {
    // Never below 1, so a 40-second trailer reads "1 min" rather than "0 min".
    const minutes = Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE));
    // 3598s is 59.97 minutes, which rounds to 60 and belongs in the hour
    // above rather than reading as "60 min".
    if (minutes === 60) return "1 hr";
    return `${minutes} min`;
  }

  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.round((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  // 59.6 minutes rounds to 60, which should read as the next hour rather than
  // "1 hr 60 min".
  if (minutes === 60) return `${hours + 1} hr`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Recent episodes are the ones people are deciding about, so the first week
// reads in plain words and everything older falls back to a date. The year
// appears only when it isn't the current one.
export function formatEpisodeDate(input, now = new Date()) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);

  // A feed with a clock ahead of ours would otherwise read "-1 days ago".
  if (days < 0) return "Just now";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// S2 E14, or just E14 when the feed numbers episodes without seasons.
export function formatEpisodeNumber(season, episodeNumber) {
  const parts = [];
  if (Number.isFinite(season) && season > 0) parts.push(`S${season}`);
  if (Number.isFinite(episodeNumber) && episodeNumber > 0) parts.push(`E${episodeNumber}`);
  return parts.length ? parts.join(" ") : null;
}

// The banner only earns its place when the episode has art of its own. Most
// feeds set no per-episode image at all, and plenty of the ones that do just
// repeat the show cover — either way a full-width image on every card would
// be the same picture down the page.
export function bannerFor(episode, showArtwork) {
  const art = episode?.artwork;
  if (!art) return null;
  return art === showArtwork ? null : art;
}

// bannerFor only sees one episode, so it cannot catch a feed that sets the
// same non-cover image on every item — a "podcast logo v2" that isn't the
// show art but is still one picture repeated down the page. Deciding once for
// the whole list closes that, and costs a single pass.
export function bannersWorthShowing(episodes, showArtwork) {
  if (!Array.isArray(episodes) || episodes.length === 0) return false;

  const banners = episodes.map((episode) => bannerFor(episode, showArtwork)).filter(Boolean);
  if (banners.length === 0) return false;

  // One distinct image covering every episode is that repeated logo. A single
  // -episode feed is exempt: there is nothing for it to repeat against.
  if (episodes.length > 1 && banners.length === episodes.length && new Set(banners).size === 1) {
    return false;
  }

  return true;
}
