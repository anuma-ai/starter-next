The `useChatStorage` hook from `@reverbia/sdk/react` provides persistent chat
storage with WatermelonDB. It manages conversations, message history, and
handles syncing between local storage and the server.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

## Hook Initialization

```ts
const {
  sendMessage,
  isLoading,
  conversationId,
  getMessages,
  getConversations,
  createConversation,
  setConversationId,
  deleteConversation,
} = useChatStorage({
  database,
  getToken,
  autoCreateConversation: true,
});
```

## Sending Messages

```ts
const streamingTextRef = useRef<string>("");

const handleSendMessage = useCallback(
  async (text: string, model: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      parts: [{ type: "text", text }],
    };

    // Create assistant placeholder message immediately for streaming
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      parts: [{ type: "text", text: "" }],
    };

    // Add both messages to state immediately
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    // Add conversation to sidebar immediately when first message is sent
    if (conversationId) {
      const title = text.length >= 30 ? `${text.slice(0, 30)}...` : text;
      setConversations((prev) => {
        const exists = prev.some(
          (c) => c.id === conversationId || c.conversationId === conversationId
        );
        if (!exists) {
          // New conversation - add it to the top with the message as title
          return [
            {
              id: conversationId,
              conversationId: conversationId,
              title,
            },
            ...prev,
          ];
        }
        // Existing conversation - update title if not set
        return prev.map((c) => {
          if ((c.id === conversationId || c.conversationId === conversationId) && !c.title) {
            return { ...c, title };
          }
          return c;
        });
      });
    }

    // Reset streaming text accumulator
    streamingTextRef.current = "";

    const response = await sendMessage({
      content: text,
      model,
      includeHistory: true,
      onData: (chunk: string) => {
        // Accumulate text
        streamingTextRef.current += chunk;

        // Notify callback for streaming updates
        if (onStreamingData) {
          onStreamingData(chunk, streamingTextRef.current);
        }
      },
    });

    // Sync final streamed text to React state after streaming completes
    const finalText = streamingTextRef.current;
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === assistantMessageId) {
          return {
            ...msg,
            parts: [{ type: "text", text: finalText }],
          };
        }
        return msg;
      })
    );

    return response;
  },
  [sendMessage, onStreamingData, conversationId]
);
```

## Conversation Management

```ts
const handleNewConversation = useCallback(async () => {
  const newConv = await createConversation();
  if (newConv) {
    setMessages([]);
  }
  return newConv;
}, [createConversation]);

const handleSwitchConversation = useCallback(
  (id: string) => {
    setConversationId(id);
  },
  [setConversationId]
);

const handleDeleteConversation = useCallback(
  async (id: string) => {
    await deleteConversation(id);
    if (conversationId === id) {
      setMessages([]);
    }
  },
  [deleteConversation, conversationId]
);
```
