/**
 * Parse display tool results from [Tool Execution Results] messages.
 *
 * Display tool results (charts, weather cards) are persisted as part of the
 * conversation messages. This helper extracts the tool name and parsed JSON
 * result from the message text so the chatbot can render the appropriate
 * component at that message's position.
 */

export type ParsedDisplayResult = {
  displayType: string;
  result: any;
};

/**
 * Extract display tool results embedded in a [Tool Execution Results] message.
 *
 * The message format is:
 *   [Tool Execution Results]
 *   Tool "display_chart" returned: { ... JSON ... }
 *   Based on these results, continue with the task.
 */
export function parseDisplayResults(text: string): ParsedDisplayResult[] {
  const results: ParsedDisplayResult[] = [];
  const regex = /Tool "display_(\w+)" returned: (.+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      results.push({
        displayType: match[1],
        result: JSON.parse(match[2]),
      });
    } catch {
      // Skip malformed JSON
    }
  }
  return results;
}
