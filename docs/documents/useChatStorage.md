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
      ...(serverTools && serverTools.length > 0 && { serverTools }),
      ...(clientTools && clientTools.length > 0 && { clientTools }),
      ...(toolChoice && { toolChoice }),
      ...(apiType && { apiType }),
      ...(explicitConversationId && { conversationId: explicitConversationId }),
      onData: (chunk: string) => {
        // Accumulate text
        streamingTextRef.current += chunk;

        // Notify callback for streaming updates
        if (onStreamingData) {
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
          // SDK wrapped format: response.data.output with function_call items
          else if (currentResponse.data?.output && Array.isArray(currentResponse.data.output)) {
            toolCalls = currentResponse.data.output.filter((item: any) => item.type === 'function_call');
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
              if (onStreamingData) {
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

    // Generate title for the first message only
    // Use isFirstMessage captured at the start of handleSendMessage
    if (isFirstMessage) {
      const userText = textForStorage || text;
      const assistantText = finalText;

      const messagesForTitle = [
        { role: "user", text: userText.slice(0, 200) },
        { role: "assistant", text: assistantText.slice(0, 200) },
      ].filter((m) => m.text);

      // Delay slightly to ensure conversation ID is available
      setTimeout(() => {
        const currentConvId = currentConversationIdRef.current;
        if (!currentConvId) return;

        generateConversationTitle(messagesForTitle, getToken).then(
          (newTitle) => {
            if (newTitle) {
              storeConversationTitle(currentConvId, newTitle);
              setConversations((prevConversations) =>
                prevConversations.map((conv) =>
                  conv.id === currentConvId ||
                  conv.conversationId === currentConvId
                    ? { ...conv, title: newTitle }
                    : conv
                )
              );
            }
          }
        );
      }, 500);
    }

    // Now that messages are in state, allow future reloads
    // Use setTimeout to ensure this happens after the conversationId might have changed
    setTimeout(() => {
      isSendingMessageRef.current = false;
    }, 100);

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
    return conv;
  }

  // Clear conversation ID so SDK will auto-create on first message
  setConversationId(null as any);
  return null;
}, [createConversation, setConversationId]);

const handleSwitchConversation = useCallback(
  async (id: string) => {
    // Update currentConversationIdRef immediately so title generation has the correct ID
    // This avoids waiting for the SDK state update cycle
    currentConversationIdRef.current = id;

    // If we're actively sending a message, don't overwrite optimistic messages
    // Just update the conversation ID in the SDK
    if (isSendingMessageRef.current) {
      loadedConversationIdRef.current = id;
      setConversationId(id);
      return;
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

        // Add text content - strip memory context prefix if present
        // For assistant messages, SDK resolves image placeholders to markdown in content
        const textContent = stripMemoryContext(msg.content);
        if (textContent) {
          parts.push({ type: "text" as const, text: textContent });
        }

        // Files may have `url` (direct data URI) or need to be read from OPFS
        // Generated images (from MCP tools) have `sourceUrl` - they're embedded in content as markdown
        const storedFiles = msg.files || [];
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
