import { updateState } from "@/lib/push/store";
import { allowRequest } from "@/lib/rateLimit";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!allowRequest(req, res)) return;

  const { endpoint } = req.body || {};
  if (typeof endpoint !== "string" || !endpoint) {
    res.status(400).json({ error: "Missing endpoint" });
    return;
  }

  try {
    await updateState((state) => ({
      ...state,
      subscriptions: state.subscriptions.filter((s) => s.endpoint !== endpoint),
    }));
  } catch (err) {
    console.error("push/unsubscribe: could not persist:", err.message ?? err);
    res.status(503).json({ error: "Couldn't remove subscription, try again later" });
    return;
  }
  res.status(200).json({ ok: true });
}
