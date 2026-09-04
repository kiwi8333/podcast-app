import { aiClient, AI_MODEL } from "@/lib/ai/client";
import { allowRequest } from "@/lib/rateLimit";

const MAX_EPISODES = 100;
const MAX_DESCRIPTION_LENGTH = 300;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // These routes spend money per call on a key held by the deployment.
  if (!allowRequest(req, res)) return;

  const { query, episodes } = req.body || {};
  if (!query || !Array.isArray(episodes) || episodes.length === 0) {
    res.status(200).json({ matches: [] });
    return;
  }

  const capped = episodes.slice(0, MAX_EPISODES).map((e) => ({
    guid: e.guid,
    title: e.title,
    description: (e.description || "").slice(0, MAX_DESCRIPTION_LENGTH),
  }));

  try {
    const response = await aiClient.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              matches: {
                type: "array",
                items: {
                  type: "object",
                  properties: { guid: { type: "string" } },
                  required: ["guid"],
                  additionalProperties: false,
                },
              },
            },
            required: ["matches"],
            additionalProperties: false,
          },
        },
      },
      system:
        "Given a search query and a list of podcast episodes (guid, title, description), return the guids of episodes relevant to the query, ordered from most to least relevant. Omit episodes that aren't relevant. Judge relevance from the given text only.",
      messages: [{ role: "user", content: `Query: ${query}\n\nEpisodes: ${JSON.stringify(capped)}` }],
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    const parsed = text ? JSON.parse(text) : { matches: [] };
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Could not run semantic search" });
  }
}
