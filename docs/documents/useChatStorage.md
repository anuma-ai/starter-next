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
  getConversation,
  getConversations,
  createConversation,
  setConversationId,
  deleteConversation,
  getAllFiles,
  createMemoryRetrievalTool,
} = useChatStorage({
  database,
  getToken,
  autoCreateConversation: true,
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  // Enable encrypted file storage in OPFS when wallet is connected
  walletAddress,
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

    //#region imagePartsUI
    if (files && files.length > 0) {
      files.forEach((file) => {
        if (file.mediaType?.startsWith("image/")) {
          parts.push({
            type: "image_url",
            image_url: { url: file.url },
          });
        } else {
          parts.push({
            type: "file",
            url: file.url,
            mediaType: file.mediaType || "",
            filename: file.filename || "",
          });
        }
      });
    }
    //#endregion imagePartsUI

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
      serverTools,
      clientTools,
      toolChoice,
      apiType,
      conversationId: explicitConversationId,
      onToolCall,
      isFirstMessage: isFirstMessageOption,
    } = options;

    // Determine if this is the first message for title generation
    // Prefer explicit option (for cases where caller adds messages before calling)
    // Fall back to checking messagesRef if no option provided
    const isFirstMessage = isFirstMessageOption ?? messagesRef.current.filter((m) => m.role === "user").length === 0;

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

    // Mark this conversation as streaming so we can preserve state when switching
    if (explicitConversationId) {
      streamingConversationIdRef.current = explicitConversationId;
      setStreamingConversationIdState(explicitConversationId);
    }

    // Use displayText for storage (clean user input), text for API (may include OCR/context)
    const textForStorage = displayText || text;

    // Build content parts for the messages array
    // The SDK extracts and stores the text from this array
    const contentParts: Array<{
      type?: string;
      text?: string;
      image_url?: { url?: string };
      file?: { file_id?: string; file_url?: string; filename?: string };
    }> = [];

    // Add text content - use clean text for storage, but we need OCR context for API
    // The SDK stores whatever is in messages, so we use displayText if available
    if (textForStorage) {
      contentParts.push({ type: "text", text: textForStorage });
    }

    //#region imageContentParts
    // Process files: create stable IDs, add to contentParts, and prepare for SDK
    const fileEntries = files || [];
    const enrichedFiles = fileEntries.map((file) => ({
      ...file,
      // Ensure each file has a stable ID (use existing or generate)
      stableId: (file as any).id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    }));

    // Add files to content parts
    enrichedFiles.forEach((file) => {
      if (file.mediaType?.startsWith("image/")) {
        contentParts.push({
          type: "image_url",
          image_url: { url: file.url },
        });
      } else {
        contentParts.push({
          type: "input_file",
          file: {
            file_id: file.stableId, // Use stable ID for matching during preprocessing
            file_url: file.url,
            filename: file.filename
          },
        });
      }
    });
    //#endregion imageContentParts

    //#region fileStorage
    // Create SDK files - SDK handles encrypted storage automatically
    const sdkFiles = enrichedFiles.map((file) => ({
      id: file.stableId,
      name: file.filename || file.stableId,
      type: file.mediaType || "application/octet-stream",
      size: 0,
      url: file.url, // SDK will encrypt and store in OPFS
    }));
    //#endregion fileStorage

    // If we have OCR/memory context that differs from displayText, pass it via memoryContext
    const memoryContext = displayText && text !== displayText ? text : undefined;

    // Build messages array with optional system prompt
    const messagesArray: Array<{ role: "system" | "user"; content: typeof contentParts }> = [];
    if (systemPrompt) {
      messagesArray.push({ role: "system" as const, content: [{ type: "text", text: systemPrompt }] });
    }
    messagesArray.push({ role: "user" as const, content: contentParts });

    const response = await sendMessage({
      messages: messagesArray,
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
      ...(serverTools && serverTools.length > 0 && { serverTools }),
      ...(clientTools && clientTools.length > 0 && { clientTools }),
      ...(toolChoice && { toolChoice }),
      ...(apiType && { apiType }),
      ...(explicitConversationId && { conversationId: explicitConversationId }),
      onData: (chunk: string) => {
        // Accumulate text
        streamingTextRef.current += chunk;

        // Only notify subscribers if user is viewing the streaming conversation
        // This prevents streaming content from conversation A appearing in conversation B
        const isViewingStreamingConversation =
          loadedConversationIdRef.current === streamingConversationIdRef.current;
        if (onStreamingData && isViewingStreamingConversation) {
          onStreamingData(chunk, streamingTextRef.current);
        }
      },
    });

    // Process tool calls if present and callback is provided
    // This implements a multi-turn tool calling loop
    if (onToolCall && clientTools && clientTools.length > 0) {
      // Use 'any' type because response format varies across different API types
      let currentResponse: any = response;
      let maxIterations = 10; // Prevent infinite loops
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;
        console.log(`[useAppChatStorage] Tool call iteration ${iteration}`);

        // Check for tool calls in the response - handle various API response formats
        let toolCalls: any[] = [];

        if (currentResponse) {
          // Direct toolCalls array
          if (currentResponse.toolCalls) {
            toolCalls = currentResponse.toolCalls;
          }
          // OpenAI format: tool_calls
          else if (currentResponse.tool_calls) {
            toolCalls = currentResponse.tool_calls;
          }
          // SDK wrapped format: response.data.output with function_call items (Responses API)
          else if (currentResponse.data?.output && Array.isArray(currentResponse.data.output)) {
            toolCalls = currentResponse.data.output.filter((item: any) => item.type === 'function_call');
          }
          // SDK wrapped format: response.data.choices with tool_calls (Completions API)
          else if (currentResponse.data?.choices && currentResponse.data.choices[0]?.message?.tool_calls) {
            toolCalls = currentResponse.data.choices[0].message.tool_calls;
          }
          // Responses API format: output array with function_call items
          else if (currentResponse.output && Array.isArray(currentResponse.output)) {
            toolCalls = currentResponse.output.filter((item: any) => item.type === 'function_call');
          }
          // Check for choices array (chat completions format)
          else if (currentResponse.choices && currentResponse.choices[0]?.message?.tool_calls) {
            toolCalls = currentResponse.choices[0].message.tool_calls;
          }
        }

        console.log('[useAppChatStorage] Detected tool calls:', toolCalls.length, toolCalls);

        // No more tool calls, we're done
        if (toolCalls.length === 0) {
          break;
        }

        // Execute all tool calls and collect results
        const toolResults: Array<{ call_id: string; output: string }> = [];

        for (const call of toolCalls) {
          try {
            // Helper to safely parse JSON arguments
            const safeParseArgs = (args: unknown): Record<string, unknown> => {
              if (args === undefined || args === null) {
                return {};
              }
              if (typeof args === 'string' && args.trim()) {
                try {
                  return JSON.parse(args);
                } catch {
                  return {};
                }
              }
              return (args as Record<string, unknown>) || {};
            };

            // Parse the tool call - handle various formats
            // Check for arguments in order: direct (Responses API) -> function.arguments (Chat Completions API)
            const rawArgs = call.arguments !== undefined ? call.arguments : call.function?.arguments;
            const toolCall: ToolCall = {
              id: call.id || call.call_id || `call_${Date.now()}`,
              name: call.name || call.function?.name,
              arguments: safeParseArgs(rawArgs),
            };

            console.log('[useAppChatStorage] Executing tool call:', toolCall);

            // Execute the tool via callback
            const result = await onToolCall(toolCall, clientTools);
            console.log('[useAppChatStorage] Tool result:', result);

            // Collect result for sending back to AI
            toolResults.push({
              call_id: toolCall.id,
              output: JSON.stringify(result),
            });
          } catch (error) {
            console.error('[useAppChatStorage] Error processing tool call:', error, call);
            toolResults.push({
              call_id: call.id || call.call_id || `call_${Date.now()}`,
              output: JSON.stringify({ error: String(error) }),
            });
          }
        }

        console.log('[useAppChatStorage] Sending tool results back to AI:', toolResults);

        // Format tool results as a context message for the AI
        // Since the API is stateless, we send tool results through the SDK as a follow-up
        const toolResultsSummary = toolResults.map((tr) => {
          const toolName = toolCalls.find(c => (c.id || c.call_id) === tr.call_id)?.name || 'unknown';
          return `Tool "${toolName}" returned: ${tr.output}`;
        }).join('\n\n');

        const continuationPrompt = `[Tool Execution Results]\nThe following tools were executed:\n\n${toolResultsSummary}\n\nBased on these results, continue with the task. If you need to call more tools (like read_file to see current content before updating, or update_file to make changes), do so now.`;

        console.log('[useAppChatStorage] Sending continuation via SDK:', continuationPrompt.slice(0, 200) + '...');

        try {
          // Use SDK to send continuation - this maintains conversation context
          currentResponse = await sendMessage({
            messages: [{ role: 'user' as const, content: [{ type: 'text', text: continuationPrompt }] }],
            model: model || 'openai/gpt-5.2-2025-12-11',
            maxOutputTokens: maxOutputTokens || 16000,
            includeHistory: true,
            clientTools: clientTools?.map((t) => ({
              type: t.type || 'function',
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
            toolChoice: 'auto',
            ...(apiType && { apiType }),
            ...(explicitConversationId && { conversationId: explicitConversationId }),
            onData: (chunk: string) => {
              streamingTextRef.current += chunk;
              // Only notify if viewing the streaming conversation
              const isViewingStreamingConversation =
                loadedConversationIdRef.current === streamingConversationIdRef.current;
              if (onStreamingData && isViewingStreamingConversation) {
                onStreamingData(chunk, streamingTextRef.current);
              }
            },
          });

          console.log('[useAppChatStorage] SDK continuation response:', currentResponse);
        } catch (error) {
          console.error('[useAppChatStorage] Error sending tool results via SDK:', error);
          break;
        }
      }

      if (iteration >= maxIterations) {
        console.warn('[useAppChatStorage] Max tool call iterations reached');
      }
    }

    // Sync final streamed text to React state after streaming completes
    const finalText = streamingTextRef.current;

    // IMPORTANT: Only update if we're still on the same conversation
    // This prevents overwriting a different conversation's messages when user switches mid-stream
    // Use explicitConversationId (what this message was sent to) vs loadedConversationIdRef (what user is viewing)
    const messageConversationId = explicitConversationId;
    const viewingConversationId = loadedConversationIdRef.current;

    if (messageConversationId && viewingConversationId && messageConversationId !== viewingConversationId) {
      // Don't update messages - user has switched to a different conversation
      // The message is saved to DB, so it will appear when user switches back to that conversation
    } else {
      setMessages((prev) => {
        return prev.map((msg) => {
          if (msg.id === assistantMessageId) {
            return {
              ...msg,
              parts: [{ type: "text", text: finalText }],
            };
          }
          return msg;
        });
      });
    }

    // Generate title for the first message only
    // Use isFirstMessage captured at the start of handleSendMessage
    // Use messageConversationId (the conversation this message was sent to), not the current viewing conversation
    if (isFirstMessage && messageConversationId) {
      const userText = textForStorage || text;
      const assistantText = finalText;

      const conversationContext = [
        { role: "user", text: userText.slice(0, 200) },
        { role: "assistant", text: assistantText.slice(0, 200) },
      ]
        .filter((m) => m.text)
        .map((m) => `${m.role}: ${m.text}`)
        .join("\n");

      // Generate title using sendMessage with skipStorage to avoid polluting the database
      // Delay slightly to ensure main message is saved first
      setTimeout(async () => {
        try {
          const titleResponse = await sendMessage({
            messages: [
              {
                role: "user" as const,
                content: [
                  {
                    type: "text",
                    text: `Generate a short, descriptive title (3-6 words) for this conversation. Return ONLY the title, nothing else.\n\nConversation:\n${conversationContext}`,
                  },
                ],
              },
            ],
            model: "openai/gpt-4o-mini",
            maxOutputTokens: 50,
            skipStorage: true,
            includeHistory: false,
          });

          if (titleResponse.error || !titleResponse.data) return;

          // Extract title from response
          let newTitle = extractTextFromResponse(titleResponse.data);
          if (newTitle) {
            // Clean up the title - remove quotes, trim whitespace
            newTitle = newTitle.replace(/^["']|["']$/g, "").trim();
            // Limit to reasonable length
            if (newTitle.length > 50) {
              newTitle = newTitle.slice(0, 47) + "...";
            }

            // Use the conversation ID this message was sent to, not where user is currently viewing
            storeConversationTitle(messageConversationId, newTitle);
            setConversations((prevConversations) =>
              prevConversations.map((conv) =>
                conv.id === messageConversationId ||
                conv.conversationId === messageConversationId
                  ? { ...conv, title: newTitle }
                  : conv
              )
            );
          }
        } catch {
          // Title generation is non-critical, silently fail
        }
      }, 500);
    }

    // Now that messages are in state, allow future reloads
    // Use setTimeout to ensure this happens after the conversationId might have changed
    setTimeout(() => {
      isSendingMessageRef.current = false;
    }, 100);

    // Clear streaming state - streaming is complete
    if (messageConversationId) {
      streamingConversationIdRef.current = null;
      setStreamingConversationIdState(null);
      streamingMessagesCacheRef.current.delete(messageConversationId);
    }

    return response;
  },
  [sendMessage, onStreamingData, getToken]
);
```

## Sending Images

Images can be sent alongside text messages. They're added to the UI immediately
and sent to the API as `image_url` content parts.

### Adding Images to UI

When building message parts for optimistic UI updates, images are converted to
`image_url` parts while other files become `file` parts.

```ts
if (files && files.length > 0) {
  files.forEach((file) => {
    if (file.mediaType?.startsWith("image/")) {
      parts.push({
        type: "image_url",
        image_url: { url: file.url },
      });
    } else {
      parts.push({
        type: "file",
        url: file.url,
        mediaType: file.mediaType || "",
        filename: file.filename || "",
      });
    }
  });
}
```

### Building Image Content for API

The content array sent to the API uses the same structure, with images as
`image_url` and other files as `input_file`.

```ts
// Process files: create stable IDs, add to contentParts, and prepare for SDK
const fileEntries = files || [];
const enrichedFiles = fileEntries.map((file) => ({
  ...file,
  // Ensure each file has a stable ID (use existing or generate)
  stableId: (file as any).id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
}));

// Add files to content parts
enrichedFiles.forEach((file) => {
  if (file.mediaType?.startsWith("image/")) {
    contentParts.push({
      type: "image_url",
      image_url: { url: file.url },
    });
  } else {
    contentParts.push({
      type: "input_file",
      file: {
        file_id: file.stableId, // Use stable ID for matching during preprocessing
        file_url: file.url,
        filename: file.filename
      },
    });
  }
});
```

### Persisting Files

Files are stored in IndexedDB for persistence across sessions. The SDK receives
file metadata without the data URL (which would be stripped anyway).

```ts
// Create SDK files - SDK handles encrypted storage automatically
const sdkFiles = enrichedFiles.map((file) => ({
  id: file.stableId,
  name: file.filename || file.stableId,
  type: file.mediaType || "application/octet-stream",
  size: 0,
  url: file.url, // SDK will encrypt and store in OPFS
}));
```

## Conversation Management

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
