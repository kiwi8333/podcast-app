import { getFavorites } from "@/lib/favorites";
import { getSubscriptionMeta } from "@/lib/subscriptions";

// The public VAPID key is safe in the bundle by design — it's what the
// browser encrypts to. The private half stays server-side.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

// PushManager wants the key as a Uint8Array, not the base64url string.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enablePush() {
  if (!isPushSupported()) throw new Error("unsupported");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const favorites = getFavorites();
  if (favorites.length === 0) throw new Error("no-subscriptions");

  // Send what this device already considers the newest episode per show, so
  // the first cron tick doesn't announce episodes the user has already seen.
  const seen = {};
  for (const favorite of favorites) {
    const guid = getSubscriptionMeta(favorite.feedUrl)?.lastKnownGuid;
    if (guid) seen[favorite.feedUrl] = guid;
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      feeds: favorites.map((f) => f.feedUrl),
      seen,
    }),
  });
  if (!res.ok) throw new Error("save-failed");
  return subscription;
}

export async function disablePush() {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe().catch(() => {});
}
