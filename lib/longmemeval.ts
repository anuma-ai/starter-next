/**
 * LongMemEval Dataset Loader for Browser
 *
 * Fetches the LongMemEval dataset from Hugging Face and caches it in IndexedDB
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

const DB_NAME = "longmemeval-cache";
const DB_VERSION = 1;
const STORE_NAME = "datasets";
const CACHE_KEY = "longmemeval_s";

// In-memory cache for faster subsequent access
let cachedDataset: LongMemEvalDataset | null = null;

/**
 * Open IndexedDB connection
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Get dataset from IndexedDB cache
 */
async function getFromCache(): Promise<LongMemEvalDataset | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);

      transaction.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Store dataset in IndexedDB cache
 */
async function saveToCache(dataset: LongMemEvalDataset): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(dataset, CACHE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();

      transaction.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn("Failed to cache dataset in IndexedDB:", err);
  }
}

/**
 * Fetch the LongMemEval dataset from Hugging Face (with IndexedDB caching)
 */
export async function fetchLongMemEvalDataset(): Promise<LongMemEvalDataset> {
  // Check in-memory cache first
  if (cachedDataset) {
    return cachedDataset;
  }

  // Check IndexedDB cache
  const cached = await getFromCache();
  if (cached) {
    cachedDataset = cached;
    return cached;
  }

  // Fetch from network
  const response = await fetch(DATASET_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset: ${response.status}`);
  }

  const dataset = (await response.json()) as LongMemEvalDataset;

  // Cache in memory and IndexedDB
  cachedDataset = dataset;
  await saveToCache(dataset);

  return dataset;
}

/**
 * Get messages from the dataset up to a specified limit
 * Returns messages from sessions, flattening them into user/assistant pairs
 */
export function getMessagesFromDataset(
  dataset: LongMemEvalDataset,
  maxMessages: number
): { conversationId: string; messages: LongMemEvalMessage[] }[] {
  const conversations: {
    conversationId: string;
    messages: LongMemEvalMessage[];
  }[] = [];
  let totalMessages = 0;

  // Iterate through entries and their sessions
  for (const entry of dataset) {
    for (
      let sessionIdx = 0;
      sessionIdx < entry.haystack_sessions.length;
      sessionIdx++
    ) {
      if (totalMessages >= maxMessages) {
        return conversations;
      }

      const session = entry.haystack_sessions[sessionIdx];
      const sessionId =
        entry.haystack_session_ids[sessionIdx] ||
        `${entry.question_id}_${sessionIdx}`;

      // Only include sessions with messages
      if (session.length > 0) {
        const messagesToAdd = Math.min(
          session.length,
          maxMessages - totalMessages
        );
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
