import { aiClient, AI_MODEL } from "@/lib/ai/client";
import { allowRequest } from "@/lib/rateLimit";

const MAX_EPISODES = 20;
const MAX_DESCRIPTION_LENGTH = 500;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // These routes spend money per call on a key held by the deployment.
  if (!allowRequest(req, res)) return;

  const { episodes } = req.body || {};
  if (!Array.isArray(episodes) || episodes.length === 0) {
    res.status(200).json({ digest: null });
    return;
  }

  const capped = episodes.slice(0, MAX_EPISODES).map((e) => ({
    podcastTitle: e.podcastTitle,
    title: e.title,
    pubDate: e.pubDate,
    description: (e.description || "").slice(0, MAX_DESCRIPTION_LENGTH),
  }));

  try {
    const response = await aiClient.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system:
        "You are summarizing what's new across a listener's podcast subscriptions since they last checked in. Group by show. Prioritize what's most notable or substantive; skip minor or promotional items. Be concise and scannable — this is a catch-up digest, not a transcript. Only use information present in the given titles/descriptions.",
      messages: [{ role: "user", content: JSON.stringify(capped) }],
    });

    const digest = response.content.find((b) => b.type === "text")?.text || null;
    res.status(200).json({ digest });
  } catch (err) {
    res.status(500).json({ error: "Could not generate digest" });
  }
}
