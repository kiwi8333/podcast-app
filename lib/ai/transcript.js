import { assertPublicHttpUrl } from "@/lib/ssrfGuard";

export async function fetchTranscript(url) {
  await assertPublicHttpUrl(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch transcript");
  return res.text();
}

// Strips VTT/SRT cue numbers and timestamp lines, leaving plain prose —
// for chat, where wording matters and timing doesn't. Chapter generation
// needs the raw timed text instead (see pages/api/ai/generate-chapters.js),
// so this is a separate step rather than baked into fetchTranscript.
export function stripTimingMarkup(rawText, type) {
  const isTimedFormat = /vtt|srt/i.test(type || "");
  if (!isTimedFormat) return rawText.trim();

  return rawText
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^\d+$/.test(trimmed)) return false; // SRT cue index
      if (/^WEBVTT/i.test(trimmed)) return false;
      if (/-->/.test(trimmed)) return false; // timestamp line
      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
