/**
 * Visitor-facing explanation of a failed /api/chat request. The server already
 * returns safe, JARVIS-aware messages (offline model, profile scope, rate limits),
 * so prefer that text and fall back to a status-based description.
 */
export function describeChatFailure(status: number, serverMessage: string): string {
  const message = serverMessage.trim();
  if (message && message.length <= 300) return message;
  if (status === 503 || status === 502 || status === 504) {
    return "The portfolio's AI (JARVIS) is offline right now. Showing answers from the published profile instead.";
  }
  if (status === 403) return "This site is not allowed to answer for this profile right now.";
  if (status === 401) return "The AI service rejected this site's server credentials.";
  if (status === 429) return "The AI is busy right now. Please wait a moment and try again.";
  return `The AI request failed (HTTP ${status}).`;
}
