import { aiClient, AI_MODEL } from "@/lib/ai/client";
import { allowRequest } from "@/lib/rateLimit";

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
          content: `Podcast: ${podcastTitle || "Unknown"}\nEpisode: ${title || "Untitled"}\nDescription: ${description}`,
        },
      ],
    });

    const summary = response.content.find((b) => b.type === "text")?.text || null;
    res.status(200).json({ summary });
  } catch (err) {
    res.status(500).json({ error: "Could not generate summary" });
  }
}
