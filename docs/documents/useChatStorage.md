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

### Optimistic UI Updates

Add messages to the UI immediately before the API responds. This creates a
snappy user experience by showing the user's message right away along with an
empty assistant placeholder that will be filled as the response streams in.

```ts
const addMessageOptimistically = useCallback(
  (text: string, files?: FileUIPart[], displayText?: string) => {
    // Mark that we're sending a message to prevent DB reload from overwriting
    isSendingMessageRef.current = true;

    // Create message parts: text first, then any files
    const parts: MessagePart[] = [];

    // Add text part if there's text
    // Use displayText for UI (without OCR)
    const textForUI = displayText || text;
    if (textForUI) {
      parts.push({ type: "text", text: textForUI });
    }

    // Add file parts (images and other files)
    if (files && files.length > 0) {
      files.forEach((file) => {
        if (file.mediaType?.startsWith("image/")) {
          // For images, create image_url part
          parts.push({
            type: "image_url",
            image_url: { url: file.url },
          });
        } else {
          // For other files (PDFs, etc), create file part
          parts.push({
            type: "file",
            url: file.url,
            mediaType: file.mediaType || "",
            filename: file.filename || "",
          });
        }
      });
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      parts,
    };

    // Create assistant placeholder message immediately for streaming
    const assistantMessageId = `assistant-${Date.now()}`;
    currentAssistantMessageIdRef.current = assistantMessageId;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      parts: [{ type: "text", text: "" }],
    };

    // Add both messages to state immediately
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    return assistantMessageId;
  },
  []
);
```

### Handling the Send

The main handler builds content parts, stores files in IndexedDB for
persistence, and calls the SDK's `sendMessage` with streaming support.

```ts
const handleSendMessage = useCallback(
  async (text: string, options: SendMessageOptions = {}) => {
    const {
      model,
      temperature,
      maxOutputTokens,
      store,
      reasoning,
      thinking,
      onThinking,
      files,
      displayText,
      skipOptimisticUpdate,
      tools,
      toolChoice,
      apiType,
    } = options;

    let assistantMessageId: string;

    // Add messages optimistically unless skipped
    if (!skipOptimisticUpdate) {
      assistantMessageId = addMessageOptimistically(text, files, displayText);
    } else {
      // Use the existing assistant message ID
      assistantMessageId =
        currentAssistantMessageIdRef.current || `assistant-${Date.now()}`;
    }

    // Reset streaming text accumulator
    streamingTextRef.current = "";

    // Use displayText for storage (clean user input), text for API (may include OCR/context)
    const textForStorage = displayText || text;

    // Build content parts for the messages array
    // The SDK extracts and stores the text from this array
    const contentParts: Array<{
      type?: string;
      text?: string;
      image_url?: { url?: string };
      file?: { file_url?: string; filename?: string };
    }> = [];

    // Add text content - use clean text for storage, but we need OCR context for API
    // The SDK stores whatever is in messages, so we use displayText if available
    if (textForStorage) {
      contentParts.push({ type: "text", text: textForStorage });
    }

    // Add file content (images and other files) to the messages array for the API
    if (files && files.length > 0) {
      files.forEach((file) => {
        if (file.mediaType?.startsWith("image/")) {
          contentParts.push({
            type: "image_url",
            image_url: { url: file.url },
          });
        } else {
          contentParts.push({
            type: "input_file",
            file: { file_url: file.url, filename: file.filename },
          });
        }
      });
    }

    // Transform FileUIPart to SDK's FileMetadata format for storage
    // Store data URLs in IndexedDB since SDK strips them
    const sdkFiles = await Promise.all(
      (files || []).map(async (file) => {
        const fileId = generateFileId();
        // Store the data URL in IndexedDB for persistence
        if (file.url) {
          await storeFile(
            fileId,
            file.url,
            file.filename || "",
            file.mediaType || "application/octet-stream"
          );
        }
        return {
          id: fileId,
          name: file.filename || fileId,
          type: file.mediaType || "application/octet-stream",
          size: 0,
          // Don't pass data URL to SDK - it will be stripped anyway
          // We retrieve it from IndexedDB using the id
        };
      })
    );

    // If we have OCR/memory context that differs from displayText, pass it via memoryContext
    const memoryContext = displayText && text !== displayText ? text : undefined;

    const response = await sendMessage({
      messages: [{ role: "user" as const, content: contentParts }],
      model,
      includeHistory: true,
      ...(temperature !== undefined && { temperature }),
      ...(maxOutputTokens !== undefined && { maxOutputTokens }),
      ...(store !== undefined && { store }),
      ...(reasoning && { reasoning }),
      ...(thinking && { thinking }),
      ...(onThinking && { onThinking }),
      ...(sdkFiles && sdkFiles.length > 0 && { files: sdkFiles }),
      ...(memoryContext && { memoryContext }),
      ...(tools && tools.length > 0 && { tools }),
      ...(toolChoice && { toolChoice }),
      ...(apiType && { apiType }),
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

    // Now that messages are in state, allow future reloads
    // Use setTimeout to ensure this happens after the conversationId might have changed
    setTimeout(() => {
      isSendingMessageRef.current = false;
    }, 100);

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
    const uiMessages: Message[] = await Promise.all(
      msgs.map(async (msg: any) => {
        const parts: MessagePart[] = [];
        if (msg.thinking) {
          parts.push({ type: "reasoning" as const, text: msg.thinking });
        }

        // SDK now stores files directly on the message, not in metadata
        // FileMetadata format: { id, name, type, size, url? }
        const storedFiles = msg.files || [];

        // Add text content - strip memory context prefix if present
        const textContent = stripMemoryContext(msg.content);
        if (textContent) {
          parts.push({ type: "text" as const, text: textContent });
        }

        // Reconstruct file parts from SDK's files array
        // Retrieve data URLs from IndexedDB using file IDs
        if (storedFiles.length > 0) {
          for (const file of storedFiles) {
            // SDK FileMetadata uses 'type' for MIME type, 'name' for filename
            const mimeType = file.type || "";
            // Try to get the data URL from IndexedDB using the file ID
            const storedFile = await getFile(file.id);
            const fileUrl = storedFile?.dataUrl || file.url || "";

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
