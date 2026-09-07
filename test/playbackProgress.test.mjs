import test from "node:test";
import assert from "node:assert/strict";
import { pruneProgress } from "../lib/playbackProgress.js";

const entry = (position, duration, updatedAt) => ({ position, duration, updatedAt });
const finished = (updatedAt) => entry(100, 100, updatedAt);
const partway = (updatedAt) => entry(10, 100, updatedAt);

const build = (count, make) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`ep-${i}`, make(i)]));

test("leaves a small record untouched", () => {
  const all = build(10, (i) => partway(i));
  assert.equal(pruneProgress(all), all, "should be the same object, not a copy");
});

test("prunes only once past the threshold", () => {
  const under = build(300, (i) => partway(i));
  assert.equal(Object.keys(pruneProgress(under)).length, 300);

  const over = build(301, (i) => partway(i));
  assert.equal(Object.keys(pruneProgress(over)).length, 200);
});

test("drops finished episodes before unfinished ones", () => {
  // Continue Listening already hides finished episodes, so they are the
  // cheapest thing to forget when storage has to give.
  const all = {
    ...Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`done-${i}`, finished(i)])),
    ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`open-${i}`, partway(1000 + i)])),
  };

  const kept = Object.keys(pruneProgress(all));
  assert.equal(kept.length, 200);
  assert.equal(kept.filter((k) => k.startsWith("open-")).length, 100, "every unfinished one survives");
  assert.equal(kept.filter((k) => k.startsWith("done-")).length, 100, "finished ones fill the rest");
});

test("keeps the most recently touched entries", () => {
  const all = build(400, (i) => partway(i)); // updatedAt ascending with i
  const kept = Object.keys(pruneProgress(all));
  assert.ok(kept.includes("ep-399"), "newest must survive");
  assert.ok(!kept.includes("ep-0"), "oldest must not");
});

test("survives entries with missing fields", () => {
  // Anything already in a user's localStorage from an older build lands here.
  const all = {
    ...build(400, (i) => partway(i)),
    broken: {},
    alsoBroken: { position: 5 },
    nullish: null,
  };
  assert.doesNotThrow(() => pruneProgress(all));
  assert.equal(Object.keys(pruneProgress(all)).length, 200);
});

test("a zero-duration entry is not treated as finished", () => {
  // position / 0 is Infinity, which would otherwise read as "past 95%".
  const all = {
    ...build(300, (i) => finished(i)),
    live: entry(30, 0, 99_999),
  };
  assert.ok(Object.keys(pruneProgress(all)).includes("live"));
});
