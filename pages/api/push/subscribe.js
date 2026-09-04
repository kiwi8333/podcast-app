import { updateState } from "@/lib/push/store";
import { isValidSubscription, isValidFeedList } from "@/lib/push/validate";
import { allowRequest } from "@/lib/rateLimit";

// One shared blob, no auth on this route by design — cap the total so a
// scripted spam of POSTs can't grow it without bound.
const MAX_SUBSCRIPTIONS = 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!allowRequest(req, res)) return;

  const { subscription, feeds, seen } = req.body || {};
  if (!isValidSubscription(subscription) || !isValidFeedList(feeds)) {
    res.status(400).json({ error: "Missing or invalid subscription or feeds" });
    return;
  }

  // The client sends the newest guid it already knows per feed. Without it
  // the first cron tick would announce the latest episode of every show as
  // if it were new — a burst of notifications for things already read.
  const seeded = {};
  if (seen && typeof seen === "object") {
    for (const url of feeds) {
      if (typeof seen[url] === "string") seeded[url] = seen[url];
    }
  }

  let rejected = false;
  try {
    await updateState((state) => {
      const others = state.subscriptions.filter((s) => s.endpoint !== subscription.endpoint);
      if (others.length >= MAX_SUBSCRIPTIONS) {
        rejected = true;
        return state;
      }
      const existing = state.subscriptions.find((s) => s.endpoint === subscription.endpoint);
      return {
        ...state,
        subscriptions: [
          ...others,
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            feeds,
            // Keep anything already seen; only seed feeds we have no record for.
            seen: { ...seeded, ...(existing?.seen ?? {}) },
            createdAt: existing?.createdAt ?? new Date().toISOString(),
          },
        ],
      };
    });
  } catch (err) {
    console.error("push/subscribe: could not persist:", err.message ?? err);
    res.status(503).json({ error: "Couldn't save subscription, try again later" });
    return;
  }

  if (rejected) {
    res.status(503).json({ error: "Subscription limit reached, try again later" });
    return;
  }
  res.status(200).json({ ok: true });
}
