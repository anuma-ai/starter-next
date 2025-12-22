The `useAppChat` hook combines `useAppChatStorage` and `useAppMemoryStorage` to
provide a complete chat experience with persistent storage and memory-augmented
responses.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

## Hook Initialization

```ts
export function useAppChat({
  database,
  getToken,
  model = "openai/gpt-4",
  useLocalEmbeddings = false,
}: UseAppChatProps) {
  const [error, setError] = useState<string | null>(null);

  // Use chat storage for message persistence
  const {
    messages,
    conversations,
    conversationId,
    isLoading,
    sendMessage: baseSendMessage,
    createConversation,
    switchConversation,
    deleteConversation,
  } = useAppChatStorage({ database, getToken });

  // Use memory storage for context-aware responses
  const { extractMemories, findRelevantMemories } = useAppMemoryStorage({
    database,
    getToken,
    useLocalEmbeddings,
  });
```

## Sending Messages

```ts
const sendMessage = useCallback(
  async (text: string) => {
    setError(null);

    try {
      // Search for relevant memories before sending
      const memories = await findRelevantMemories(text);

      if (memories.length > 0) {
        console.log(`Found ${memories.length} relevant memories for context`);
      }

      // Send the message
      const response = await baseSendMessage(text, model);

      // Extract memories from the user message in the background
      extractMemories(text, model).catch((err) => {
        console.error("Failed to extract memories:", err);
      });

      return response;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
      throw err;
    }
  },
  [baseSendMessage, model, findRelevantMemories, extractMemories]
);
```
