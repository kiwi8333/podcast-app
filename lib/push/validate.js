// A real push subscription always comes from the browser's PushManager, so
// the endpoint is an https URL and the keys are non-empty base64url strings.
// These endpoints have no auth — that is how subscribing works — so shape
// validation is the only thing between them and a script filling the blob
// with junk that can never receive a push but still counts against the cap.
export function isValidSubscription(subscription) {
  if (!subscription || typeof subscription.endpoint !== "string") return false;
  try {
    if (new URL(subscription.endpoint).protocol !== "https:") return false;
  } catch {
    return false;
  }
  const { keys } = subscription;
  return (
    keys &&
    typeof keys.p256dh === "string" &&
    keys.p256dh.length > 0 &&
    typeof keys.auth === "string" &&
    keys.auth.length > 0
  );
}

export function isValidFeedList(feeds) {
  if (!Array.isArray(feeds) || feeds.length === 0 || feeds.length > 200) return false;
  return feeds.every((url) => {
    if (typeof url !== "string" || url.length > 2000) return false;
    try {
      return ["http:", "https:"].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  });
}
