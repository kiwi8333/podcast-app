import { aiClient, AI_MODEL } from "@/lib/ai/client";
import { allowRequest } from "@/lib/rateLimit";
import { clampText, MAX_DESCRIPTION_CHARS, MAX_TITLE_CHARS } from "@/lib/ai/limits";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // These routes spend money per call on a key held by the deployment.
  if (!allowRequest(req, res)) return;

  const { title, description, podcastTitle } = req.body || {};
  if (!description || description.trim().length < 20) {
    res.status(200).json({ summary: null });
    return;
  }

  try {
    const response = await aiClient.messages.create({
      model: AI_MODEL,
      max_tokens: 300,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system:
        "Condense the given podcast episode description into a scannable 2-3 sentence summary. Only use information present in the title and description — never invent facts, guests, or claims not stated there.",
      messages: [
        {
          role: "user",
          content: `Podcast: ${clampText(podcastTitle, MAX_TITLE_CHARS) || "Unknown"}\nEpisode: ${
            clampText(title, MAX_TITLE_CHARS) || "Untitled"
          }\nDescription: ${clampText(description, MAX_DESCRIPTION_CHARS)}`,
        },
      ],
    });

    const summary = response.content.find((b) => b.type === "text")?.text || null;
    res.status(200).json({ summary });
  } catch (err) {
    res.status(500).json({ error: "Could not generate summary" });
  }
}
