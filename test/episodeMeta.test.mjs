import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDuration,
  formatDuration,
  formatEpisodeDate,
  formatEpisodeNumber,
  bannerFor,
  bannersWorthShowing,
} from "../lib/episodeMeta.js";

// itunes:duration is specified as HH:MM:SS and honoured loosely. Every shape
// below is one feeds actually send.
test("parses the duration shapes feeds send", () => {
  assert.equal(parseDuration("3600"), 3600, "bare seconds");
  assert.equal(parseDuration("28:31"), 1711, "MM:SS");
  assert.equal(parseDuration("01:02:03"), 3723, "HH:MM:SS");
  assert.equal(parseDuration("1:02:03"), 3723, "unpadded hours");
  assert.equal(parseDuration(1800), 1800, "a number, not a string");
  assert.equal(parseDuration("  90  "), 90, "surrounding whitespace");
});

test("returns null rather than NaN for junk", () => {
  for (const bad of [null, undefined, "", "   ", "abc", "12:99", "1:2:3:4", "-5", "0"]) {
    assert.equal(parseDuration(bad), null, `should reject ${JSON.stringify(bad)}`);
    assert.equal(formatDuration(bad), null, `should format ${JSON.stringify(bad)} as nothing`);
  }
});

test("formats durations the way a listener reads them", () => {
  assert.equal(formatDuration("1711"), "29 min");
  assert.equal(formatDuration("28:31"), "29 min");
  assert.equal(formatDuration("3600"), "1 hr");
  assert.equal(formatDuration("3723"), "1 hr 2 min");
  assert.equal(formatDuration("5400"), "1 hr 30 min");
});

test("rounds a sub-minute clip up instead of to zero", () => {
  assert.equal(formatDuration("40"), "1 min", "a 40-second trailer is not 0 min");
  assert.equal(formatDuration("1"), "1 min");
});

test("carries a rounded 60 minutes into the hour", () => {
  // 3598s is 59.97 minutes, which must not print as "0 hr 60 min".
  assert.equal(formatDuration("3598"), "1 hr");
  assert.equal(formatDuration("7198"), "2 hr");
});

const now = new Date(2026, 8, 10, 12, 0, 0); // 10 Sep 2026, local

test("reads the first week in words", () => {
  assert.equal(formatEpisodeDate(new Date(2026, 8, 10, 7, 0), now), "Today");
  assert.equal(formatEpisodeDate(new Date(2026, 8, 9, 23, 0), now), "Yesterday");
  assert.equal(formatEpisodeDate(new Date(2026, 8, 7), now), "3 days ago");
  assert.equal(formatEpisodeDate(new Date(2026, 8, 4), now), "6 days ago");
});

test("falls back to a date once past a week", () => {
  const week = formatEpisodeDate(new Date(2026, 8, 3), now);
  assert.match(week, /Sep/, "same year shows day and month");
  assert.doesNotMatch(week, /2026/, "and omits the current year");

  const older = formatEpisodeDate(new Date(2024, 8, 3), now);
  assert.match(older, /2024/, "a previous year is spelled out");
});

test("survives a feed whose clock runs ahead of ours", () => {
  assert.equal(formatEpisodeDate(new Date(2026, 8, 12), now), "Just now", "never '-2 days ago'");
});

test("returns null for a date it cannot read", () => {
  for (const bad of [null, undefined, "", "not a date"]) {
    assert.equal(formatEpisodeDate(bad, now), null);
  }
});

test("labels season and episode only when numbered", () => {
  assert.equal(formatEpisodeNumber(2, 14), "S2 E14");
  assert.equal(formatEpisodeNumber(null, 14), "E14", "feeds that number without seasons");
  assert.equal(formatEpisodeNumber(2, null), "S2");
  assert.equal(formatEpisodeNumber(null, null), null);
  assert.equal(formatEpisodeNumber(0, 0), null, "zero is not an episode number");
});

test("shows a banner only for art the episode actually owns", () => {
  const show = "https://cdn.test/show.jpg";
  assert.equal(bannerFor({ artwork: "https://cdn.test/ep7.jpg" }, show), "https://cdn.test/ep7.jpg");
  assert.equal(bannerFor({ artwork: show }, show), null, "repeating the cover is not a banner");
  assert.equal(bannerFor({ artwork: null }, show), null, "most feeds set no episode art");
  assert.equal(bannerFor({}, show), null);
  assert.equal(bannerFor(undefined, show), null);
});

test("suppresses banners when one image is repeated on every episode", () => {
  const show = "https://cdn.test/show.jpg";
  const logo = "https://cdn.test/logo-v2.jpg";

  // The case bannerFor alone cannot see: not the cover, but still one picture.
  const repeated = [{ artwork: logo }, { artwork: logo }, { artwork: logo }];
  assert.equal(bannersWorthShowing(repeated, show), false);

  // Genuinely per-episode art, as SoundCloud feeds actually provide.
  const distinct = [
    { artwork: "https://cdn.test/a.jpg" },
    { artwork: "https://cdn.test/b.jpg" },
    { artwork: "https://cdn.test/c.jpg" },
  ];
  assert.equal(bannersWorthShowing(distinct, show), true);
});

test("a one-episode feed still gets its banner", () => {
  const show = "https://cdn.test/show.jpg";
  assert.equal(bannersWorthShowing([{ artwork: "https://cdn.test/only.jpg" }], show), true);
});

test("no banners when the feed sets no episode art, which is most of them", () => {
  const show = "https://cdn.test/show.jpg";
  assert.equal(bannersWorthShowing([{}, {}, {}], show), false);
  assert.equal(bannersWorthShowing([{ artwork: show }, { artwork: show }], show), false);
  assert.equal(bannersWorthShowing([], show), false);
  assert.equal(bannersWorthShowing(null, show), false);
});

test("a mixed feed still shows the episodes that have their own art", () => {
  const show = "https://cdn.test/show.jpg";
  const mixed = [{ artwork: "https://cdn.test/a.jpg" }, {}, { artwork: show }];
  assert.equal(bannersWorthShowing(mixed, show), true);
});
