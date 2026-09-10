import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStations, filterStations, ghanaEvidence } from "../lib/radio.js";

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
  language: "akan,english",
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
  assert.equal(only.language, "akan,english");
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
    // Keeps a Ghanaian language so the entry survives the Ghana filter; this
    // case is about filterStations, not about qualifying.
    station({ stationuuid: "a", name: "Joy FM", tags: "news", language: "akan", url_resolved: "https://a.test/" }),
    station({ stationuuid: "b", name: "Nhyira FM", tags: "music", language: "twi", url_resolved: "https://b.test/" }),
  ]);

  assert.deepEqual(filterStations(stations, "joy").map((s) => s.name), ["Joy FM"]);
  assert.deepEqual(filterStations(stations, "twi").map((s) => s.name), ["Nhyira FM"]);
  assert.deepEqual(filterStations(stations, "news").map((s) => s.name), ["Joy FM"]);
  assert.equal(filterStations(stations, "JOY").length, 1, "case-insensitive");
  assert.equal(filterStations(stations, "   ").length, 2, "blank query filters nothing");
  assert.equal(filterStations(stations, "zzz").length, 0);
});

// The country code the directory is queried by is community-set, and its
// Ghana listing verifiably contains stations from elsewhere. Each case below
// is a real entry from that listing, named so a future change that lets one
// back in says which one.

test("accepts a Ghanaian language tag", () => {
  assert.equal(ghanaEvidence(station({ language: "akan" })), "language");
  assert.equal(ghanaEvidence(station({ language: "english - twi" })), "language");
  assert.equal(ghanaEvidence(station({ language: "ewe" })), "language");
});

test("does not accept Hausa on its own", () => {
  // Spoken in northern Ghana, but far more widely in Nigeria and Niger, so it
  // is not evidence by itself. Zuria FM, the one Hausa station in the real
  // listing, still qualifies on its streaming host.
  const zuria = station({ language: "hausa", name: "Zuria Fm", homepage: "", tags: "" });
  assert.equal(ghanaEvidence({ ...zuria, url_resolved: "https://elsewhere.test/s" }), null);
  assert.equal(
    ghanaEvidence({ ...zuria, url_resolved: "https://zuria-atunwadigital.streamguys1.com/z" }),
    "stream-host"
  );
});

test("matches Ghana inside a compound domain", () => {
  // All three are real Ghanaian stations whose only signal is the domain, and
  // a word-boundary rule rejected every one of them.
  const bare = { language: "", tags: "", lastcheckok: 1, url_resolved: "https://x.test/s" };
  assert.equal(ghanaEvidence({ ...bare, name: "SHATTA Movement", homepage: "https://radio.modernghana.com" }), "place");
  assert.equal(ghanaEvidence({ ...bare, name: "LiveXtra Fm", homepage: "https://livefmghana.com" }), "place");
  assert.equal(ghanaEvidence({ ...bare, name: "ChinaGhana Fm", homepage: "https://www.chinaghana.com" }), "place");
});

test("matches a Ghanaian streaming host behind a hyphenated prefix", () => {
  // "lawsonfm963-atunwadigital.streamguys1.com" — matching on a dot boundary
  // dropped Lawson Radio, which broadcasts in Ghana.
  const lawson = station({
    name: "Lawson Radio 96.3", language: "", tags: "", homepage: "https://worldsradios.online/",
    url_resolved: "https://lawsonfm963-atunwadigital.streamguys1.com/lawson",
  });
  assert.equal(ghanaEvidence(lawson), "stream-host");
});

test("does not match a short place name inside another word", () => {
  // "tema" sits inside "Asenteman".
  const asenteman = station({
    name: "Asenteman Radio", language: "", tags: "", homepage: "https://example.test",
    url_resolved: "https://example.test/s",
  });
  assert.equal(ghanaEvidence(asenteman), null, "should not qualify on Tema");
  assert.equal(ghanaEvidence({ ...asenteman, name: "Tema Community Radio" }), "place");
});

test("rejects the stations the Ghana listing wrongly carries", () => {
  const notGhana = [
    ["057 radio", "https://www.057info.hr", "", "https://audio.alter-media.hr/9052/stream"],
    ["Abdulbasit Abdulsamad", "https://mp3islam.com", "arabic", "https://radio.mp3islam.com/x"],
    ["Amen FM", "https://www.amenfm.com", "", "https://ice7.securenetsystems.net/AMENFM"],
    ["Box Lofi Radio", "https://zeno.fm", "", "https://stream.zeno.fm/tabzverz0fctv"],
    ["Afro Nation Radio", "https://www.afronation.com", "", "https://stream-176.surfernetwork.com/x"],
    ["Torq Radio", "https://www.torqradio.com", "", "https://s4.radio.co/se63becd16/listen"],
  ];
  for (const [name, homepage, language, url] of notGhana) {
    const entry = { name, homepage, language, tags: "", lastcheckok: 1, url_resolved: url };
    assert.equal(ghanaEvidence(entry), null, `${name} should not be listed as Ghanaian`);
    assert.deepEqual(normalizeStations([entry]), [], `${name} should not survive normalizing`);
  }
});

test("keeps the verified homepages and nothing near them", () => {
  const bare = { language: "", tags: "", lastcheckok: 1, url_resolved: "https://generic.test/s" };
  assert.equal(ghanaEvidence({ ...bare, name: "Oroko Radio", homepage: "https://oroko.live" }), "verified-homepage");
  assert.equal(ghanaEvidence({ ...bare, name: "Rainbow Radio", homepage: "https://rainbowradioonline.com" }), "verified-homepage");
  // Checked and found to carry no Ghana evidence, so deliberately absent.
  assert.equal(ghanaEvidence({ ...bare, name: "West End Radio", homepage: "https://www.westendfmonline.com" }), null);
  assert.equal(ghanaEvidence({ ...bare, name: "360Africa Radio", homepage: "https://360africahitz.com" }), null);
});

test("accepts a .gh domain and a name that says GH", () => {
  const bare = { language: "", tags: "", lastcheckok: 1, url_resolved: "https://x.test/s" };
  assert.equal(ghanaEvidence({ ...bare, name: "GBC Radio", homepage: "https://gbcghanaonline.com.gh" }), "place");
  assert.equal(ghanaEvidence({ ...bare, name: "Infinity Radio GH", homepage: "https://x.test" }), "domain");
});
