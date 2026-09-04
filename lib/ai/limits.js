// Every /api/ai/* route bills a key held by the deployment, so the size of
// what a caller can push into a prompt is a spending limit, not a nicety.
// The transcript and episode-list inputs were already capped; the free-text
// fields around them were not, which left the cheapest way to run up a bill
// as "send a 5MB question" rather than "send many questions" — and only the
// second is what the per-minute rate limit counts.

export const MAX_QUESTION_CHARS = 2000;
export const MAX_TITLE_CHARS = 300;
export const MAX_DESCRIPTION_CHARS = 4000;
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_HISTORY_MESSAGE_CHARS = 4000;

// Returns a trimmed string of at most `max` characters, or "" for anything
// that isn't a string. Callers that need to reject rather than truncate
// should length-check before calling.
export function clampText(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

// The chat route replays the history the client hands back. That array is
// fully client-controlled: nothing stopped a caller sending a thousand turns
// of filler, or role values the API rejects. Keep the most recent turns,
// drop anything malformed, and cap each one.
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, MAX_HISTORY_MESSAGE_CHARS),
    }));
}
