# Memory Retrieval

The `useAppChat` hook adds memory-augmented responses on top of
`useAppChatStorage`. Memory lets the AI recall information from past
conversations — things like the user's name, preferences, or previously
discussed topics — so it can give contextual answers without the user repeating
themselves.

## How It Works

Memory operates in two phases: storage and retrieval.

**Storage.** The SDK automatically embeds every message when it's stored. Long
messages are split into chunks, and each chunk gets a vector embedding (a
numerical representation of its meaning). These vectors live in WatermelonDB
alongside the message content.

**Retrieval.** When a new message is sent, a memory retrieval tool is injected
as a client tool. The AI reads the system prompt, which tells it about the tool,
and decides whether the user's question might benefit from past context. If so,
it calls the tool. The tool converts the query into a vector, runs a similarity
search against all stored embeddings (excluding the current conversation), and
returns the closest matching chunks.

The AI then uses those chunks as context to formulate its response. If the
question doesn't need memory (e.g., "what's 2+2"), the AI simply doesn't call
the tool.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

## Memory Settings

Three settings control memory behavior. They're persisted in `localStorage` and
synced across tabs via `StorageEvent`, so changes from the settings page take
effect immediately without a reload.

```ts
const [memoryEnabled, setMemoryEnabled] = useState(true);
const [memoryLimit, setMemoryLimit] = useState(5);
const [memoryThreshold, setMemoryThreshold] = useState(0.2);
```

- `memoryEnabled` — toggle memory on or off. Default: `true`.
- `memoryLimit` — max chunks returned per search (1–20). Default: `5`. Higher
  values provide more context but use more tokens.
- `memoryThreshold` — minimum similarity score (0.0–0.8). Default: `0.2` (20%).
  Lower values return more matches; higher values are stricter.

Settings are loaded from `localStorage` on mount and updated in real time when
changed from another tab or the settings page:

```ts
// Load memory settings from localStorage
useEffect(() => {
  const savedEnabled = localStorage.getItem("chat_memoryEnabled");
  if (savedEnabled !== null) {
    setMemoryEnabled(savedEnabled === "true");
  }

  const savedLimit = localStorage.getItem("chat_memoryLimit");
  if (savedLimit) {
    const limit = parseInt(savedLimit, 10);
    if (!isNaN(limit) && limit > 0) {
      setMemoryLimit(limit);
    }
  }

  const savedThreshold = localStorage.getItem("chat_memoryThreshold");
  if (savedThreshold) {
    const threshold = parseFloat(savedThreshold);
    if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
      setMemoryThreshold(threshold);
    }
  }

  // Listen for changes from settings page
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === "chat_memoryEnabled" && e.newValue !== null) {
      setMemoryEnabled(e.newValue === "true");
    }
    if (e.key === "chat_memoryLimit" && e.newValue) {
      const limit = parseInt(e.newValue, 10);
      if (!isNaN(limit) && limit > 0) {
        setMemoryLimit(limit);
      }
    }
    if (e.key === "chat_memoryThreshold" && e.newValue) {
      const threshold = parseFloat(e.newValue);
      if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
        setMemoryThreshold(threshold);
      }
    }
  };
  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}, []);
```

## Creating the Memory Tool

On each `sendMessage` call, a memory retrieval tool is created with the current
settings and added to the client tools array. The current conversation is
excluded so the AI only recalls information from other conversations.

If the conversation is brand new (no ID yet), one is created first so the
exclusion works correctly.

When memory is disabled, the tool is simply omitted.

```ts
// Ensure we have a conversation ID BEFORE creating the memory tool
// This is critical for excludeConversationId to work on new conversations
let effectiveConversationId = options?.conversationId || conversationId;
if (!effectiveConversationId) {
  // Create a new conversation first so we have an ID to exclude
  // Pass createImmediately to actually create the conversation now (not on first message)
  const newConv = await createConversation({ createImmediately: true });
  if (newConv) {
    effectiveConversationId = newConv.conversationId;
  }
}

// Only include memory tool if memory retrieval is enabled
const effectiveClientTools = memoryEnabled
  ? [
      createMemoryRetrievalTool({
        limit: memoryLimit,
        minSimilarity: memoryThreshold,
        excludeConversationId: effectiveConversationId ?? undefined,
      }),
      ...baseClientTools,
    ]
  : baseClientTools;
```

## System Prompt

The default system prompt tells the AI when to use the memory tool:

```
You have access to a memory retrieval tool that can recall information from
previous conversations with this user. When the user asks questions that might
relate to past conversations (like their name, preferences, personal
information, or previously discussed topics), use the memory retrieval tool to
recall relevant context before responding.
```

This can be overridden by passing a custom `systemPrompt` to the hook.
