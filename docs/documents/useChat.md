The `useChat` hook combines `useChatStorage` and `useMemoryStorage` from
`@reverbia/sdk/react` to provide a complete chat experience with persistent
storage and memory-augmented responses. It handles message sending, conversation
management, and automatic memory extraction from user messages.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

## Chat Storage Initialization

The hook uses `useChatStorage` internally for message persistence:

```ts
// Use useChatStorage for persistence
const {
  sendMessage: baseSendMessage,
  isLoading,
  conversationId,
  getMessages,
  getConversations,
  createConversation: baseCreateConversation,
  setConversationId: baseSetConversationId,
  deleteConversation: baseDeleteConversation,
} = useChatStorage({
  database: options?.database!,
  getToken: options?.getToken,
  autoCreateConversation: true,
});
```

## Memory Storage Initialization

Memory storage enables semantic search over past conversations:

```ts
const embeddingProvider = enableLocalModels.embeddings ? "local" : "api";
const embeddingModelConfig = enableLocalModels.embeddings
  ? "Snowflake/snowflake-arctic-embed-xs"
  : options?.embeddingModel || "openai/text-embedding-3-small";

const { extractMemoriesFromMessage, searchMemories } = useMemoryStorage({
  database: options?.database as Database,
  getToken: options?.getToken,
  generateEmbeddings: true,
  embeddingProvider,
  embeddingModel: embeddingModelConfig,
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
});
```
