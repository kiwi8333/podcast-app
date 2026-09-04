import { aiClient, AI_MODEL } from "@/lib/ai/client";
import { allowRequest } from "@/lib/rateLimit";
import { fetchTranscript, stripTimingMarkup } from "@/lib/ai/transcript";

const MAX_TRANSCRIPT_CHARS = 20000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // These routes spend money per call on a key held by the deployment.
  if (!allowRequest(req, res)) return;

  const { question, transcriptUrl, transcriptType, title, description, conversationHistory } =
    req.body || {};

  if (!question || !transcriptUrl) {
    res.status(400).json({ error: "Missing question or transcriptUrl" });
    return;
  }

  let transcript;
  try {
    const raw = await fetchTranscript(transcriptUrl);
    transcript = stripTimingMarkup(raw, transcriptType);
  } catch {
    res.status(400).json({ error: "Could not load transcript" });
    return;
  }

  const truncated = transcript.slice(0, MAX_TRANSCRIPT_CHARS);
  const history = Array.isArray(conversationHistory) ? conversationHistory : [];

  try {
    const response = await aiClient.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      // The transcript runs to 20k characters and was re-sent at full price
      // on every follow-up question. Caching the system block makes each
      // later turn far cheaper. Caching is a prefix match, so this text has
      // to stay byte-identical between turns — it does, since it's rebuilt
      // from the same transcript URL each time.
      system: [
        {
          type: "text",
          text: `Answer questions about this podcast episode using only the transcript below. If the answer isn't in the transcript, say so plainly rather than guessing.\n\nEpisode: ${title || "Untitled"}\n${description ? `Description: ${description}\n` : ""}\nTranscript:\n${truncated}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [...history, { role: "user", content: question }],
    });

    const answer = response.content.find((b) => b.type === "text")?.text || "";
    res.status(200).json({
      answer,
      conversationHistory: [
        ...history,
        { role: "user", content: question },
        { role: "assistant", content: answer },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: "Could not answer that question" });
  }
}
