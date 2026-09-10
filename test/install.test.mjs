import test from "node:test";
import assert from "node:assert/strict";
import { detectIos, detectInstalled, shouldOffer, SNOOZE_MS } from "../lib/install.js";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15";
const IPAD_OS13 = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile";

test("detects iPhone and iPad", () => {
  assert.equal(detectIos(IPHONE, 5), true);
  assert.equal(detectIos("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)", 5), true);
});

test("detects an iPad that claims to be a Mac", () => {
  // iPadOS 13+ sends a desktop user agent; the touchscreen is the only tell.
  assert.equal(detectIos(IPAD_OS13, 5), true, "touch + Mac UA is an iPad");
  assert.equal(detectIos(MAC, 0), false, "a real Mac has no touch points");
  assert.equal(detectIos(MAC, 1), false, "one touch point is not a touchscreen");
});

test("does not mistake Android for iOS", () => {
  assert.equal(detectIos(ANDROID, 5), false);
  assert.equal(detectIos("", 0), false);
  assert.equal(detectIos(undefined, undefined), false);
});

test("detects an installed app from either spelling", () => {
  assert.equal(detectInstalled({ displayModeStandalone: true }), true);
  assert.equal(detectInstalled({ navigatorStandalone: true }), true, "iOS-only spelling");
  assert.equal(detectInstalled({}), false);
  assert.equal(detectInstalled(), false, "missing argument is not installed");
});

const base = { installed: false, canPrompt: true, ios: false, dismissedAt: null, now: 1_000_000_000 };

test("offers when the browser has handed over a prompt", () => {
  assert.equal(shouldOffer(base), true);
});

test("offers on iOS, which never hands over a prompt", () => {
  assert.equal(shouldOffer({ ...base, canPrompt: false, ios: true }), true);
});

test("stays silent with no prompt and no iOS instructions to give", () => {
  assert.equal(shouldOffer({ ...base, canPrompt: false, ios: false }), false);
});

test("never offers once the app is installed", () => {
  assert.equal(shouldOffer({ ...base, installed: true }), false);
  assert.equal(shouldOffer({ ...base, installed: true, ios: true }), false);
});

test("honours a dismissal for the full snooze", () => {
  const { now } = base;
  assert.equal(shouldOffer({ ...base, dismissedAt: now - 1 }), false, "just dismissed");
  assert.equal(shouldOffer({ ...base, dismissedAt: now - (SNOOZE_MS - 1) }), false, "one ms short");
  assert.equal(shouldOffer({ ...base, dismissedAt: now - SNOOZE_MS }), true, "snooze elapsed");
});

test("treats a dismissal timestamp in the future as a dismissal", () => {
  // A clock that moved backwards should leave the banner hidden, not make it
  // reappear on every load.
  assert.equal(shouldOffer({ ...base, dismissedAt: base.now + 60_000 }), false);
});

test("ignores a stored value that is not a usable timestamp", () => {
  for (const bad of [null, undefined, "yesterday", NaN, Infinity, {}]) {
    assert.equal(shouldOffer({ ...base, dismissedAt: bad }), true, `should ignore ${String(bad)}`);
  }
});
