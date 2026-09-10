import { readJson, writeJson } from "./localStore.js";

const DISMISS_KEY = "podcast-app:install-dismissed";

// Long enough that saying no means no. An install banner that returns next
// week is the reason people learn to ignore banners.
export const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

// iPadOS 13 and later report a desktop Safari user agent, so the iPad is only
// distinguishable from a Mac by the fact that it has a touchscreen. Without
// the maxTouchPoints half of this, iPads never see the instructions and, as
// the platform offers no install API, would have no route in at all.
export function detectIos(userAgent = "", maxTouchPoints = 0) {
  const ua = String(userAgent);
  if (/iphone|ipod/i.test(ua)) return true;
  if (/ipad/i.test(ua)) return true;
  return /macintosh|mac os x/i.test(ua) && maxTouchPoints > 1;
}

// Two spellings because they come from different eras: display-mode covers
// Android and desktop, navigator.standalone is the iOS-only original and is
// still the only one Safari sets.
export function detectInstalled({ displayModeStandalone = false, navigatorStandalone = false } = {}) {
  return Boolean(displayModeStandalone || navigatorStandalone);
}

// Kept pure and separate from the component so the decision can be tested
// without a browser: this is the part with the edge cases, and the component
// around it is only wiring.
export function shouldOffer({ installed, canPrompt, ios, dismissedAt, now }) {
  // Already on the home screen — there is nothing left to offer.
  if (installed) return false;

  if (typeof dismissedAt === "number" && Number.isFinite(dismissedAt)) {
    const elapsed = now - dismissedAt;
    // A negative elapsed means the clock moved backwards or the stored value
    // is in the future. Treating that as "recently dismissed" errs towards
    // staying quiet, which is the right way to be wrong about a banner.
    if (elapsed < SNOOZE_MS) return false;
  }

  // Android and desktop Chrome hand over a real prompt. iOS never will, so
  // the only thing left there is telling the user where the button is.
  return Boolean(canPrompt || ios);
}

export function getDismissedAt() {
  const value = readJson(DISMISS_KEY, null);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function recordDismissal(now = Date.now()) {
  return writeJson(DISMISS_KEY, now);
}
