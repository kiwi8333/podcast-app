import { aiClient, AI_MODEL } from "@/lib/ai/client";
import { allowRequest } from "@/lib/rateLimit";
import { clampText, MAX_TITLE_CHARS } from "@/lib/ai/limits";

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
    podcastTitle: clampText(e.podcastTitle, MAX_TITLE_CHARS),
    title: clampText(e.title, MAX_TITLE_CHARS),
    pubDate: clampText(e.pubDate, 64),
    description: (e.description || "").slice(0, MAX_DESCRIPTION_LENGTH),
  }));

  try {
    const response = await aiClient.messages.create({
      model: AI_MODEL,
      // 20 episodes grouped by show does not fit in 1024 tokens on a busy
      // week, and the route reads the first text block either way — so the
      // digest simply stopped mid-sentence with nothing to say it had.
      max_tokens: 4000,
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
