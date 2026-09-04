// A real push subscription always comes from the browser's PushManager, so
// the endpoint is an https URL and the keys are non-empty base64url strings.
// These endpoints have no auth — that is how subscribing works — so shape
// validation is the only thing between them and a script filling the blob
// with junk that can never receive a push but still counts against the cap.
//
// Length ceilings matter as much as the shapes. The subscription cap bounds
// how many records the blob holds but says nothing about how big each one
// is: unbounded keys plus 200 feed URLs of unbounded length let a caller
// grow one record into megabytes, and the whole store is read and rewritten
// on every subscribe and every cron tick.

// A P-256 public key is 65 bytes and the auth secret is 16, which is 88 and
// 24 base64url characters. The margin allows for padding variants.
const MAX_P256DH_LENGTH = 140;
const MAX_AUTH_LENGTH = 48;
const MAX_ENDPOINT_LENGTH = 2000;
const MAX_FEEDS = 200;
const MAX_FEED_URL_LENGTH = 2000;
// Bounds one record's feed list overall, so 200 URLs at the per-URL maximum
// can't add 400KB to a document every reader has to parse.
const MAX_FEEDS_TOTAL_LENGTH = 20_000;

const BASE64URL = /^[A-Za-z0-9_-]+=*$/;

export function isValidSubscription(subscription) {
  if (!subscription || typeof subscription.endpoint !== "string") return false;
  if (subscription.endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    if (new URL(subscription.endpoint).protocol !== "https:") return false;
  } catch {
    return false;
  }
  const { keys } = subscription;
  if (!keys || typeof keys !== "object") return false;

  const validKey = (value, maxLength) =>
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    BASE64URL.test(value);

  return validKey(keys.p256dh, MAX_P256DH_LENGTH) && validKey(keys.auth, MAX_AUTH_LENGTH);
}

export function isValidFeedList(feeds) {
  if (!Array.isArray(feeds) || feeds.length === 0 || feeds.length > MAX_FEEDS) return false;
  let total = 0;
  return feeds.every((url) => {
    if (typeof url !== "string" || url.length > MAX_FEED_URL_LENGTH) return false;
    total += url.length;
    if (total > MAX_FEEDS_TOTAL_LENGTH) return false;
    try {
      return ["http:", "https:"].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  });
}
