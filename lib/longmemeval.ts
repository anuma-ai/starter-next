/**
 * LongMemEval Dataset Loader for Browser
 *
 * Fetches the LongMemEval dataset from Hugging Face for seeding test data
 */

export type LongMemEvalMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LongMemEvalSession = LongMemEvalMessage[];

export type LongMemEvalEntry = {
  question_id: string;
  question_type: string;
  question: string;
  answer: string;
  question_date: string;
  answer_session_ids: string[];
  haystack_dates: string[];
  haystack_session_ids: string[];
  haystack_sessions: LongMemEvalSession[];
};

export type LongMemEvalDataset = LongMemEvalEntry[];

const DATASET_URL =
  "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_s_cleaned.json";

let cachedDataset: LongMemEvalDataset | null = null;

/**
 * Fetch the LongMemEval dataset from Hugging Face
 */
export async function fetchLongMemEvalDataset(): Promise<LongMemEvalDataset> {
  if (cachedDataset) {
    return cachedDataset;
  }

  const response = await fetch(DATASET_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset: ${response.status}`);
  }

  cachedDataset = (await response.json()) as LongMemEvalDataset;
  return cachedDataset;
}

/**
 * Get messages from the dataset up to a specified limit
 * Returns messages from sessions, flattening them into user/assistant pairs
 */
export function getMessagesFromDataset(
  dataset: LongMemEvalDataset,
  maxMessages: number
): { conversationId: string; messages: LongMemEvalMessage[] }[] {
  const conversations: { conversationId: string; messages: LongMemEvalMessage[] }[] = [];
  let totalMessages = 0;

  // Iterate through entries and their sessions
  for (const entry of dataset) {
    for (let sessionIdx = 0; sessionIdx < entry.haystack_sessions.length; sessionIdx++) {
      if (totalMessages >= maxMessages) {
        return conversations;
      }

      const session = entry.haystack_sessions[sessionIdx];
      const sessionId = entry.haystack_session_ids[sessionIdx] || `${entry.question_id}_${sessionIdx}`;

      // Only include sessions with messages
      if (session.length > 0) {
        const messagesToAdd = Math.min(session.length, maxMessages - totalMessages);
        conversations.push({
          conversationId: `longmemeval_${sessionId}`,
          messages: session.slice(0, messagesToAdd),
        });
        totalMessages += messagesToAdd;
      }
    }
  }

  return conversations;
}

/**
 * Get dataset statistics
 */
export function getDatasetStats(dataset: LongMemEvalDataset): {
  totalEntries: number;
  totalSessions: number;
  totalMessages: number;
} {
  let totalSessions = 0;
  let totalMessages = 0;

  for (const entry of dataset) {
    totalSessions += entry.haystack_sessions.length;
    for (const session of entry.haystack_sessions) {
      totalMessages += session.length;
    }
  }

  return {
    totalEntries: dataset.length,
    totalSessions,
    totalMessages,
  };
}
