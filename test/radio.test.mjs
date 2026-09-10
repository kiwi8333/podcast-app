import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStations, filterStations } from "../lib/radio.js";

// Shaped like a Radio Browser record, with only the fields the normalizer
// reads. Everything the directory returns is community-submitted, so each
// case here is something its Ghana listing actually contains.
const station = (overrides = {}) => ({
  stationuuid: "uuid-1",
  name: "Joy FM",
  url: "https://mmg.streamguys1.com/JoyFM-mp3",
  url_resolved: "https://mmg.streamguys1.com/JoyFM-mp3",
  homepage: "https://myjoyonline.com",
  favicon: "https://example.test/joy.png",
  tags: "news,talk",
  language: "english",
  codec: "MP3",
  bitrate: 128,
  votes: 108,
  lastcheckok: 1,
  ...overrides,
});

test("keeps a healthy https station and maps its fields", () => {
  const [only] = normalizeStations([station()]);
  assert.equal(only.name, "Joy FM");
  assert.equal(only.streamUrl, "https://mmg.streamguys1.com/JoyFM-mp3");
  assert.equal(only.codec, "MP3");
  assert.equal(only.bitrate, 128);
  assert.equal(only.language, "english");
  assert.deepEqual(only.tags, ["news", "talk"]);
});

test("drops http streams, which are blocked as mixed content", () => {
  const insecure = station({
    url: "http://mounthoreb1.primcast.com:8210/",
    url_resolved: "http://mounthoreb1.primcast.com:8210/",
  });
  assert.deepEqual(normalizeStations([insecure]), []);
});

test("drops stations the directory's own health check is failing", () => {
  assert.deepEqual(normalizeStations([station({ lastcheckok: 0 })]), []);
});

test("drops entries with no usable url or name", () => {
  assert.deepEqual(normalizeStations([station({ url: "", url_resolved: "" })]), []);
  assert.deepEqual(normalizeStations([station({ url: "not a url", url_resolved: "" })]), []);
  assert.deepEqual(normalizeStations([station({ name: "   " })]), []);
});

test("reports an unmeasured bitrate as absent rather than as zero", () => {
  const [only] = normalizeStations([station({ bitrate: 0 })]);
  assert.equal(only.bitrate, null, "0 means never measured, not a 0kbps stream");
});

test("orders by votes before de-duplicating, so the popular spelling wins", () => {
  // The real listing carries both of these, pointing at one stream.
  const stations = normalizeStations([
    station({ stationuuid: "b", name: "Citi FM", votes: 51, url_resolved: "https://citi.test/s" }),
    station({ stationuuid: "a", name: "citi fm", votes: 4714, url_resolved: "https://citi.test/s" }),
  ]);
  assert.equal(stations.length, 1);
  assert.equal(stations[0].name, "citi fm");
  assert.equal(stations[0].votes, 4714);
});

test("treats a trailing slash as the same stream", () => {
  const stations = normalizeStations([
    station({ stationuuid: "a", name: "A", url_resolved: "https://x.test/live" }),
    station({ stationuuid: "b", name: "B", url_resolved: "https://x.test/live/" }),
  ]);
  assert.equal(stations.length, 1);
});

test("collapses a duplicate name that differs only in case or spacing", () => {
  const stations = normalizeStations([
    station({ stationuuid: "a", name: "Peace FM", votes: 125, url_resolved: "https://p.test/1" }),
    station({ stationuuid: "b", name: "peace  fm", votes: 3, url_resolved: "https://p.test/2" }),
  ]);
  assert.equal(stations.length, 1);
  assert.equal(stations[0].votes, 125);
});

test("honours the limit", () => {
  const many = Array.from({ length: 80 }, (_, i) =>
    station({ stationuuid: `s${i}`, name: `S${i}`, url_resolved: `https://x.test/${i}`, votes: i })
  );
  assert.equal(normalizeStations(many, { limit: 10 }).length, 10);
  assert.equal(normalizeStations(many, { limit: 10 })[0].votes, 79, "highest voted first");
});

test("survives a shape it did not expect instead of throwing", () => {
  assert.deepEqual(normalizeStations(null), []);
  assert.deepEqual(normalizeStations(undefined), []);
  assert.deepEqual(normalizeStations("nope"), []);
  assert.deepEqual(normalizeStations([null, 42, "x", {}]), []);
});

test("filters across name, language and tags", () => {
  const stations = normalizeStations([
    station({ stationuuid: "a", name: "Joy FM", tags: "news", language: "english", url_resolved: "https://a.test/" }),
    station({ stationuuid: "b", name: "Nhyira FM", tags: "music", language: "twi", url_resolved: "https://b.test/" }),
  ]);

  assert.deepEqual(filterStations(stations, "joy").map((s) => s.name), ["Joy FM"]);
  assert.deepEqual(filterStations(stations, "twi").map((s) => s.name), ["Nhyira FM"]);
  assert.deepEqual(filterStations(stations, "news").map((s) => s.name), ["Joy FM"]);
  assert.equal(filterStations(stations, "JOY").length, 1, "case-insensitive");
  assert.equal(filterStations(stations, "   ").length, 2, "blank query filters nothing");
  assert.equal(filterStations(stations, "zzz").length, 0);
});
