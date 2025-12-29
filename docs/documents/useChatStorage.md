# Sending messages

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
  async (text: string, options: SendMessageOptions = {}) => {
    const { model, temperature, maxOutputTokens, store, reasoning, thinking, onThinking } = options;
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

    // Reset streaming text accumulator
    streamingTextRef.current = "";

    const response = await sendMessage({
      content: text,
      model,
      includeHistory: true,
      ...(temperature !== undefined && { temperature }),
      ...(maxOutputTokens !== undefined && { maxOutputTokens }),
      ...(store !== undefined && { store }),
      ...(reasoning && { reasoning }),
      ...(thinking && { thinking }),
      ...(onThinking && { onThinking }),
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
  [sendMessage, onStreamingData]
);
```

## Conversation Management

```ts
const handleNewConversation = useCallback(async () => {
  // Reset to empty state - let SDK auto-create conversation on first message
  setMessages([]);
  loadedConversationIdRef.current = null;
  setConversationId(null as any); // Clear current conversation
}, [setConversationId]);

const handleSwitchConversation = useCallback(
  async (id: string) => {
    // Preload messages before switching to prevent flicker
    // This ensures new messages are ready before we update state
    const msgs = await getMessages(id);
    const uiMessages: Message[] = msgs.map((msg: any) => {
      const parts: MessagePart[] = [];
      if (msg.thinking) {
        parts.push({ type: "reasoning" as const, text: msg.thinking });
      }
      parts.push({ type: "text" as const, text: msg.content });
      return {
        id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
        role: msg.role,
        parts,
      };
    });

    // Update ref first to prevent useEffect from re-loading
    loadedConversationIdRef.current = id;
    // Direct state updates
    setMessages(uiMessages);
    setConversationId(id);
  },
  [setConversationId, getMessages]
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
