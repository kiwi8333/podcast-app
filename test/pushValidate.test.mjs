import test from "node:test";
import assert from "node:assert/strict";
import { isValidSubscription, isValidFeedList } from "../lib/push/validate.js";

// A realistic PushManager subscription: 88-character P-256 key, 22-character
// auth secret, https endpoint.
const REAL_KEYS = {
  p256dh: "BDDmmv_vcuc1TitMolt-VfxM1xTOEqbZe7bwI1H7170tIB-NvPIr5FcShXgxuN6lAOezI1tCshtHCn_Ubj7-7e8",
  auth: "k8QQP71dInbMId9mHE730o",
};
const valid = (overrides = {}) => ({
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: REAL_KEYS,
  ...overrides,
});

test("accepts a real subscription", () => {
  // If this ever fails the endpoint is rejecting legitimate browsers, which
  // is worse than the abuse the rest of these tests describe.
  assert.equal(isValidSubscription(valid()), true);
});

test("requires an https endpoint", () => {
  assert.equal(isValidSubscription(valid({ endpoint: "http://push.example.com/x" })), false);
  assert.equal(isValidSubscription(valid({ endpoint: "ftp://push.example.com/x" })), false);
  assert.equal(isValidSubscription(valid({ endpoint: "not a url" })), false);
});

test("rejects missing or malformed shapes without throwing", () => {
  assert.equal(isValidSubscription(null), false);
  assert.equal(isValidSubscription(undefined), false);
  assert.equal(isValidSubscription({}), false);
  assert.equal(isValidSubscription(valid({ keys: null })), false);
  assert.equal(isValidSubscription(valid({ keys: "not-an-object" })), false);
  assert.equal(isValidSubscription({ endpoint: 42, keys: REAL_KEYS }), false);
});

test("bounds key length so one record cannot grow without limit", () => {
  // The subscription cap limits how many records exist, not how big one is.
  // A P-256 key is 88 characters; 200,000 is someone filling the blob.
  assert.equal(isValidSubscription(valid({ keys: { ...REAL_KEYS, p256dh: "A".repeat(200_000) } })), false);
  assert.equal(isValidSubscription(valid({ keys: { ...REAL_KEYS, auth: "A".repeat(5_000) } })), false);
});

test("bounds endpoint length", () => {
  assert.equal(
    isValidSubscription(valid({ endpoint: `https://push.example.com/${"a".repeat(3000)}` })),
    false
  );
});

test("requires keys to look like base64url", () => {
  assert.equal(isValidSubscription(valid({ keys: { ...REAL_KEYS, p256dh: "<script>" } })), false);
  assert.equal(isValidSubscription(valid({ keys: { ...REAL_KEYS, auth: "has spaces" } })), false);
  assert.equal(isValidSubscription(valid({ keys: { ...REAL_KEYS, p256dh: "" } })), false);
});

test("accepts a plausible feed list", () => {
  assert.equal(isValidFeedList(["https://example.com/feed.xml"]), true);
  assert.equal(isValidFeedList(["http://example.com/a", "https://example.com/b"]), true);
});

test("rejects empty, oversized, and non-array feed lists", () => {
  assert.equal(isValidFeedList([]), false);
  assert.equal(isValidFeedList(null), false);
  assert.equal(isValidFeedList("https://example.com/feed.xml"), false);
  assert.equal(isValidFeedList(Array(201).fill("https://example.com/f")), false);
});

test("rejects non-http feed URLs", () => {
  assert.equal(isValidFeedList(["javascript:alert(1)"]), false);
  assert.equal(isValidFeedList(["data:text/xml,<rss/>"]), false);
  assert.equal(isValidFeedList(["https://ok.example/f", "not a url"]), false);
  assert.equal(isValidFeedList([123]), false);
});

test("bounds the feed list in total, not just per entry", () => {
  // 200 entries each just under the per-URL limit passed every individual
  // check while adding ~400KB to a document the cron rewrites every run.
  const long = `https://example.com/${"p".repeat(1900)}`;
  assert.equal(isValidFeedList([long]), true, "one long URL is still fine");
  assert.equal(isValidFeedList(Array(200).fill(long)), false, "200 of them are not");
});
