# Conversation management

The `useChatStorage` hook exposes methods for creating, switching between, and
deleting conversations. These are typically wired up to a sidebar or
conversation list component.

## Creating a Conversation

There are two modes: auto-create on first message (the default when
`autoCreateConversation: true` is set), or create immediately for cases like
navigating to a project page where you need a conversation ID upfront.

```ts
const handleNewConversation = useCallback(async (opts?: { projectId?: string; createImmediately?: boolean }) => {
  // Reset UI state
  setMessages([]);
  loadedConversationIdRef.current = null;

  // If createImmediately is true (e.g., from project page), create conversation now
  // Otherwise, just reset state - conversation will be created on first message via autoCreateConversation
  if (opts?.createImmediately || opts?.projectId) {
    const conv = await createConversation(opts);

    // Mark this conversation as already "loaded" to prevent useEffect from loading empty DB results
    // The caller will add optimistic messages after we return
    if (conv?.conversationId) {
      loadedConversationIdRef.current = conv.conversationId;
    }

    return conv;
  }

  // Clear conversation ID so SDK will auto-create on first message
  setConversationId(null as any);
  return null;
}, [createConversation, setConversationId]);
```

## Switching Conversations

Switching handles several edge cases: skipping redundant loads, caching
messages for conversations that are still streaming, and restoring cached
messages when switching back to a streaming conversation. Messages are preloaded
before the state update to prevent flicker.

```ts
const handleSwitchConversation = useCallback(
  async (id: string) => {
    // Skip if this conversation is already loaded (prevents overwriting optimistic messages)
    // This handles the case where page.tsx syncs from URL after chatbot.tsx created a new conversation
    if (loadedConversationIdRef.current === id) {
      currentConversationIdRef.current = id;
      setConversationId(id);
      return;
    }

    // If switching away from a streaming conversation, cache its messages
    const currentLoadedId = loadedConversationIdRef.current;
    if (currentLoadedId && streamingConversationIdRef.current === currentLoadedId) {
      streamingMessagesCacheRef.current.set(currentLoadedId, messagesRef.current);
    }

    // Update currentConversationIdRef immediately so title generation has the correct ID
    // This avoids waiting for the SDK state update cycle
    currentConversationIdRef.current = id;

    // If switching TO a streaming conversation, restore from cache
    if (streamingConversationIdRef.current === id) {
      const cachedMessages = streamingMessagesCacheRef.current.get(id);
      if (cachedMessages) {
        loadedConversationIdRef.current = id;
        // Update the assistant message with current streaming text before restoring
        // The streaming text accumulates in streamingTextRef while user is on another conversation
        const currentStreamingText = streamingTextRef.current;
        const assistantMsgId = currentAssistantMessageIdRef.current;
        const updatedMessages = cachedMessages.map((msg) => {
          if (msg.id === assistantMsgId && currentStreamingText) {
            return {
              ...msg,
              parts: [{ type: "text" as const, text: currentStreamingText }],
            };
          }
          return msg;
        });
        setMessages(updatedMessages);
        setConversationId(id);
        return;
      }
    }

    // Preload messages before switching to prevent flicker
    const msgs = await getMessages(id);
    const uiMessages: Message[] = await Promise.all(
      msgs.map(async (msg: any) => {
        const parts: MessagePart[] = [];
        if (msg.thinking) {
          parts.push({ type: "reasoning" as const, text: msg.thinking });
        }
        if (msg.error && msg.role === "assistant") {
          parts.push({ type: "error" as const, error: msg.error });
        }
        if (msg.content) {
          parts.push({ type: "text" as const, text: msg.content });
        }
        // Resolve file references from msg.files or msg.fileIds,
        // decrypting from OPFS when wallet is connected
        const fileParts = await resolveMessageFiles(msg, walletAddress);
        parts.push(...fileParts);
        return {
          id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
          role: msg.role,
          parts,
        };
      })
    );

    loadedConversationIdRef.current = id;
    setMessages(uiMessages);
    setConversationId(id);
  },
  [setConversationId, getMessages]
);
```

## Deleting a Conversation

```ts
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
