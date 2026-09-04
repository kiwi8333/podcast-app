import { aiClient, AI_MODEL } from "@/lib/ai/client";
import { allowRequest } from "@/lib/rateLimit";
import { fetchTranscript } from "@/lib/ai/transcript";

const MAX_TRANSCRIPT_CHARS = 40000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // These routes spend money per call on a key held by the deployment.
  if (!allowRequest(req, res)) return;

  const { transcriptUrl, transcriptType, title } = req.body || {};
  if (!transcriptUrl) {
    res.status(400).json({ error: "Missing transcriptUrl" });
    return;
  }

  // Only VTT/SRT carry real per-line timing — a plain-text transcript has no
  // timestamps for the model to extract, so don't offer this for those.
  const isTimedFormat = /vtt|srt/i.test(transcriptType || "");
  if (!isTimedFormat) {
    res.status(400).json({ error: "Auto-chapters need a timed transcript (VTT or SRT)" });
    return;
  }

  let raw;
  try {
    raw = await fetchTranscript(transcriptUrl);
  } catch {
    res.status(400).json({ error: "Could not load transcript" });
    return;
  }

  const truncated = raw.slice(0, MAX_TRANSCRIPT_CHARS);

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
              chapters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    startTime: { type: "number" },
                    title: { type: "string" },
                  },
                  required: ["startTime", "title"],
                  additionalProperties: false,
                },
              },
            },
            required: ["chapters"],
            additionalProperties: false,
          },
        },
      },
      system: `Identify natural topic-change points in this timed transcript (VTT or SRT format) and produce chapter markers. Convert each chapter's own cue timestamp to seconds for startTime — do not estimate or invent timestamps not present in the transcript. Give each chapter a short, descriptive title. Episode: ${title || "Untitled"}.`,
      messages: [{ role: "user", content: truncated }],
    });

    const text = response.content.find((b) => b.type === "text")?.text;
    const parsed = text ? JSON.parse(text) : { chapters: [] };
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Could not generate chapters" });
  }
}
