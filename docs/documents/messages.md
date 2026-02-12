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
  signMessage: signMessageProp,
  embeddedWalletSigner,
});
```

## Optimistic UI Updates

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

## Send Setup

The send handler destructures options, triggers the optimistic update, sets a
temporary conversation title on the first message, and initializes streaming
state.

```ts
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

// Set a temporary title from the user's first message so the sidebar
// shows something meaningful while the LLM-generated title loads
if (isFirstMessage && explicitConversationId) {
  const tempTitle = (displayText || text).slice(0, 30);
  storeConversationTitle(
    explicitConversationId,
    tempTitle.length >= 30 ? `${tempTitle}...` : tempTitle
  );
}

// Reset streaming text accumulator
streamingTextRef.current = "";

// Mark this conversation as streaming so we can preserve state when switching
if (explicitConversationId) {
  streamingConversationIdRef.current = explicitConversationId;
  setStreamingConversationIdState(explicitConversationId);
}
```

## Building Content Parts

Content parts are assembled for the SDK. Text is added first, then files are
enriched with stable IDs. Images become `image_url` parts, other files become
`input_file` parts. File metadata is also passed to the SDK for encrypted OPFS
storage.

```ts
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
```

## Calling sendMessage

The SDK call passes the content parts, model configuration, and a streaming
callback. Options like `temperature`, `reasoning`, `serverTools`, and
`clientTools` are conditionally spread so only provided values are sent.

```ts
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
  ...(serverTools && (typeof serverTools === "function" || serverTools.length > 0) && { serverTools }),
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
```

## Tool Calling

When client tools are configured and the response contains tool calls, a
multi-turn loop executes them. The loop detects tool calls across multiple API
response formats (Responses API, Chat Completions API, SDK-wrapped formats),
runs each tool via the `onToolCall` callback, and sends results back as a
continuation message.

```ts
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
```

## Title Generation

On the first message in a conversation, a temporary title is set from the
user's text immediately so the sidebar shows something meaningful. After the
response completes, an LLM-generated title replaces it asynchronously using
`sendMessage` with `skipStorage: true`.

```ts
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
```

## Post-Stream Cleanup

After streaming completes, the final accumulated text is synced to React state.
If the user switched to a different conversation mid-stream, the update is
skipped — the message is already saved to the database and will appear when
they switch back. Streaming refs and caches are then cleared.

```ts
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
```
