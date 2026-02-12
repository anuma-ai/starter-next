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
    // This ensures new messages are ready before we update state
    const msgs = await getMessages(id);
    const uiMessages: Message[] = await Promise.all(
      msgs.map(async (msg: any) => {
        const parts: MessagePart[] = [];
        if (msg.thinking) {
          parts.push({ type: "reasoning" as const, text: msg.thinking });
        }

        // If an assistant message has an error, surface it as an error part
        if (msg.error && msg.role === "assistant") {
          parts.push({ type: "error" as const, error: msg.error });
        }

        // For assistant messages, SDK resolves image placeholders to markdown in content
        const textContent = msg.content;
        if (textContent) {
          parts.push({ type: "text" as const, text: textContent });
        }

        // SDK stores file metadata in two ways:
        // 1. `files` - Old style with full FileMetadata (includes url, id, etc.)
        // 2. `fileIds` - New style with just media IDs (for OPFS-stored files)
        const storedFiles = msg.files || [];
        const storedFileIds = msg.fileIds || [];

        // Handle old-style files array
        if (storedFiles.length > 0) {
          for (const file of storedFiles) {
            const mimeType = file.type || "";
            let fileUrl = file.url || "";

            // If no URL but file has an ID, try to read from OPFS (user uploads)
            if (!fileUrl && file.id && !file.sourceUrl && walletAddress && hasEncryptionKey(walletAddress)) {
              try {
                const encryptionKey = await getEncryptionKey(walletAddress);
                const result = await readEncryptedFile(file.id, encryptionKey);
                if (result) {
                  fileUrl = await blobToDataUrl(result.blob);
                }
              } catch (err) {
                console.error(`Failed to read file ${file.id} from OPFS:`, err);
              }
            }

            if (!fileUrl) continue;

            if (mimeType.startsWith("image/")) {
              parts.push({
                type: "image_url" as const,
                image_url: { url: fileUrl },
              });
            } else {
              parts.push({
                type: "file" as const,
                url: fileUrl,
                mediaType: mimeType,
                filename: file.name || "",
              });
            }
          }
        }

        // Handle new-style fileIds (media IDs for OPFS-stored files)
        if (storedFiles.length === 0 && storedFileIds.length > 0 && walletAddress && hasEncryptionKey(walletAddress)) {
          for (const mediaId of storedFileIds) {
            try {
              const encryptionKey = await getEncryptionKey(walletAddress);
              const result = await readEncryptedFile(mediaId, encryptionKey);
              if (result) {
                const fileUrl = await blobToDataUrl(result.blob);
                const mimeType = result.metadata?.type || "application/octet-stream";

                if (mimeType.startsWith("image/")) {
                  parts.push({
                    type: "image_url" as const,
                    image_url: { url: fileUrl },
                  });
                } else {
                  parts.push({
                    type: "file" as const,
                    url: fileUrl,
                    mediaType: mimeType,
                    filename: result.metadata?.name || mediaId,
                  });
                }
              }
            } catch (err) {
              console.error(`Failed to read file ${mediaId} from OPFS:`, err);
            }
          }
        }

        return {
          id: msg.uniqueId ?? `msg-${Date.now()}-${Math.random()}`,
          role: msg.role,
          parts,
        };
      })
    );

    // Update ref first to prevent useEffect from re-loading
    loadedConversationIdRef.current = id;
    // Direct state updates
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
    console.log("[useAppChatStorage] Deleting conversation:", id);
    try {
      const result = await deleteConversation(id);
      console.log("[useAppChatStorage] Delete result:", result);
      if (conversationId === id) {
        setMessages([]);
      }
    } catch (error) {
      console.error("[useAppChatStorage] Delete failed:", error);
      throw error;
    }
  },
  [deleteConversation, conversationId]
);
```
