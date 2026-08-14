const TEXT_TYPES = ["text/plain", "text/vtt", "application/srt", "application/json", "text/html"];

export function isTimedTranscriptType(type) {
  return /vtt|srt/i.test(type || "");
}

// Picks which transcript entry to use when a feed publishes more than one
// (e.g. different languages or formats). `preferTimed` favors a VTT/SRT entry
// first (needed for the synced transcript view and auto-chapters); otherwise
// just picks the first recognizable text-ish type.
export function pickTranscript(transcripts, { preferTimed = false } = {}) {
  if (!transcripts?.length) return null;
  if (preferTimed) {
    const timed = transcripts.find((t) => isTimedTranscriptType(t.type));
    if (timed) return timed;
  }
  return transcripts.find((t) => TEXT_TYPES.includes((t.type || "").toLowerCase())) || transcripts[0];
}

function parseTimestamp(str) {
  const match = str.trim().match(/(\d+):(\d{2}):(\d{2})[.,](\d+)/);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

// Parses VTT or SRT text into [{ start, end, text }] segments, in seconds.
// Trailing VTT cue settings (e.g. "align:start position:0%") are tolerated —
// parseTimestamp only matches the leading HH:MM:SS.mmm pattern.
export function parseTimedTranscript(rawText) {
  const blocks = rawText.replace(/\r\n/g, "\n").split(/\n\n+/);
  const segments = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim());
    const timingLine = lines.find((line) => line.includes("-->"));
    if (!timingLine) continue;

    const [startStr, endStr] = timingLine.split("-->");
    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);
    if (start == null) continue;

    const text = lines
      .filter((line) => line !== timingLine && !/^\d+$/.test(line.trim()) && !/^WEBVTT/i.test(line.trim()))
      .join(" ")
      .trim();

    if (text) segments.push({ start, end: end ?? start, text });
  }

  return segments;
}
