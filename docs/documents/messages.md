# Sending messages

The `useChatStorage` hook from `@reverbia/sdk/react` provides persistent chat
storage with WatermelonDB. It manages conversations, message history, and
streams responses from the API.

## Hook Initialization

Pass the values from the Setup page into `useChatStorage`. The hook returns
methods for sending messages, managing conversations, and working with files.
See Setup for how to obtain `database`, `getToken`, and the wallet fields.

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
  // WatermelonDB instance — set up once at app root with your schema
  database,
  // Privy identity token — wraps useIdentityToken() with caching and expiry refresh
  getToken,
  // Create a conversation automatically on the first message instead of upfront
  autoCreateConversation: true,
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  // Wallet-based encryption: when set, files are encrypted in OPFS using a key
  // derived from a wallet signature. signMessage prompts the user to sign,
  // embeddedWalletSigner signs silently via an embedded wallet.
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
    isSendingMessageRef.current = true;

    // Build parts: text first, then images as image_url, other files as file
    const parts: MessagePart[] = [];
    const textForUI = displayText || text;
    if (textForUI) {
      parts.push({ type: "text", text: textForUI });
    }
    files?.forEach((file) => {
      parts.push(
        file.mediaType?.startsWith("image/")
          ? { type: "image_url", image_url: { url: file.url } }
          : { type: "file", url: file.url, mediaType: file.mediaType || "", filename: file.filename || "" }
      );
    });

    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", parts };

    // Empty assistant placeholder — filled as the response streams in
    const assistantMessageId = `assistant-${Date.now()}`;
    currentAssistantMessageIdRef.current = assistantMessageId;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      parts: [{ type: "text", text: "" }],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    return assistantMessageId;
  },
  []
);
```

## Building Content Parts

While the optimistic update builds parts for the UI, the API payload needs a
different format. Text is the same, but files are included as content parts
in the messages array — images as `image_url`, other files as `input_file`.
Each file gets a stable ID so the SDK can match it back to extracted text
after file preprocessing (see `preprocessFiles` in the SDK docs). A separate
`sdkFiles` array provides metadata so the SDK can encrypt and store files
in OPFS.

```ts
const contentParts: any[] = [];
if (textForStorage) {
  contentParts.push({ type: "text", text: textForStorage });
}

// Stable IDs let the SDK match files back to their extracted text after preprocessing
const enrichedFiles = (files || []).map((file) => ({
  ...file,
  stableId: (file as any).id || `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
}));

// Images become image_url parts; other files become input_file parts
enrichedFiles.forEach((file) => {
  contentParts.push(
    file.mediaType?.startsWith("image/")
      ? { type: "image_url", image_url: { url: file.url } }
      : { type: "input_file", file: { file_id: file.stableId, file_url: file.url, filename: file.filename } }
  );
});

// SDK file metadata — the SDK encrypts and stores these in OPFS automatically
const sdkFiles = enrichedFiles.map((file) => ({
  id: file.stableId,
  name: file.filename || file.stableId,
  type: file.mediaType || "application/octet-stream",
  size: 0,
  url: file.url,
}));
```

## Calling sendMessage

The content parts and an optional system prompt are assembled into a messages
array, then passed to `sendMessage`. Each option is conditionally spread so
only provided values are sent. The `onData` callback streams text chunks to
the UI as they arrive. See `SendMessageWithStorageArgs` in the SDK docs for
the full list of options.

```ts
const messagesArray: any[] = [];
if (systemPrompt) {
  messagesArray.push({ role: "system", content: [{ type: "text", text: systemPrompt }] });
}
messagesArray.push({ role: "user", content: contentParts });

// See SendMessageWithStorageArgs in the SDK docs for the full list of options
const response = await sendMessage({
  messages: messagesArray,
  model,
  includeHistory: true,
  ...(temperature !== undefined && { temperature }),
  ...(maxOutputTokens !== undefined && { maxOutputTokens }),
  ...(reasoning && { reasoning }),
  ...(sdkFiles && sdkFiles.length > 0 && { files: sdkFiles }),
  ...(serverTools && (typeof serverTools === "function" || serverTools.length > 0) && { serverTools }),
  ...(clientTools && clientTools.length > 0 && { clientTools }),
  ...(store !== undefined && { store }),
  ...(thinking && { thinking }),
  ...(onThinking && { onThinking }),
  ...(memoryContext && { memoryContext }),
  ...(toolChoice && { toolChoice }),
  ...(apiType && { apiType }),
  ...(explicitConversationId && { conversationId: explicitConversationId }),
  onData: (chunk: string) => {
    streamingTextRef.current += chunk;
    if (onStreamingData && loadedConversationIdRef.current === streamingConversationIdRef.current) {
      onStreamingData(chunk, streamingTextRef.current);
    }
  },
});
```

## Tool Calling

When client tools are provided and the model returns tool calls, a loop
executes them locally via the `onToolCall` callback and sends results back to
the model. The loop runs up to 10 iterations to handle chained tool calls.
`extractToolCalls` and `safeParseArgs` are app-level helpers that normalize
tool call formats across the Responses API, Chat Completions API, and
SDK-wrapped responses.

```ts
// Multi-turn tool calling loop (max 10 iterations)
if (onToolCall && clientTools && clientTools.length > 0) {
  let currentResponse: any = response;
  let iteration = 0;

  while (iteration++ < 10) {
    // extractToolCalls normalizes across Responses API, Chat Completions, and SDK formats
    const toolCalls = extractToolCalls(currentResponse);
    if (toolCalls.length === 0) break;

    // Execute each tool and collect results
    const toolResults: Array<{ call_id: string; output: string }> = [];
    for (const call of toolCalls) {
      try {
        const toolCall: ToolCall = {
          id: call.id || call.call_id || `call_${Date.now()}`,
          name: call.name || call.function?.name,
          arguments: safeParseArgs(call.arguments ?? call.function?.arguments),
        };
        const result = await onToolCall(toolCall, clientTools);
        toolResults.push({ call_id: toolCall.id, output: JSON.stringify(result) });
      } catch (error) {
        toolResults.push({
          call_id: call.id || call.call_id || `call_${Date.now()}`,
          output: JSON.stringify({ error: String(error) }),
        });
      }
    }

    // Send results back to the model as a continuation message
    const summary = toolResults.map((tr) => {
      const name = toolCalls.find(c => (c.id || c.call_id) === tr.call_id)?.name || 'unknown';
      return `Tool "${name}" returned: ${tr.output}`;
    }).join('\n\n');

    try {
      currentResponse = await sendMessage({
        messages: [{ role: 'user', content: [{ type: 'text', text: `[Tool Execution Results]\n\n${summary}\n\nBased on these results, continue with the task.` }] }],
        model: model || 'openai/gpt-5.2-2025-12-11',
        maxOutputTokens: maxOutputTokens || 16000,
        includeHistory: true,
        clientTools: clientTools?.map((t) => ({
          type: t.type || 'function',
          // Handle both nested (SDK tools) and flat (app-builder tools) structures
          name: (t as any).function?.name || t.name,
          description: (t as any).function?.description || t.description,
          parameters: (t as any).function?.arguments || t.parameters,
        })),
        toolChoice: 'auto',
        ...(apiType && { apiType }),
        ...(explicitConversationId && { conversationId: explicitConversationId }),
        onData: (chunk: string) => {
          streamingTextRef.current += chunk;
          if (onStreamingData && loadedConversationIdRef.current === streamingConversationIdRef.current) {
            onStreamingData(chunk, streamingTextRef.current);
          }
        },
      });
    } catch {
      break;
    }
  }
}
```

## Title Generation

After the first message, an LLM-generated title is created asynchronously
using `sendMessage` with `skipStorage: true` so the title request isn't saved
as a conversation message. `extractTextFromResponse` and
`storeConversationTitle` are app-level helpers — the SDK provides
`updateConversationTitle` on the hook result for the same purpose.

```ts
// Generate an LLM title after the first message in a conversation.
// Uses skipStorage so the title request isn't saved as a conversation message.
if (isFirstMessage && messageConversationId) {
  const context = [
    { role: "user", text: (textForStorage || text).slice(0, 200) },
    { role: "assistant", text: finalText.slice(0, 200) },
  ].filter((m) => m.text).map((m) => `${m.role}: ${m.text}`).join("\n");

  setTimeout(async () => {
    try {
      const titleResponse = await sendMessage({
        messages: [{ role: "user", content: [{ type: "text",
          text: `Generate a short, descriptive title (3-6 words) for this conversation. Return ONLY the title, nothing else.\n\nConversation:\n${context}` }] }],
        model: "openai/gpt-4o-mini",
        maxOutputTokens: 50,
        skipStorage: true,
        includeHistory: false,
      });
      if (titleResponse.error || !titleResponse.data) return;

      let newTitle = extractTextFromResponse(titleResponse.data);
      if (!newTitle) return;
      newTitle = newTitle.replace(/^["']|["']$/g, "").trim();
      if (newTitle.length > 50) newTitle = newTitle.slice(0, 47) + "...";
      storeConversationTitle(messageConversationId, newTitle);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === messageConversationId || c.conversationId === messageConversationId
            ? { ...c, title: newTitle } : c
        )
      );
    } catch {
      // Title generation is non-critical
    }
  }, 500);
}
```

## Post-Stream Cleanup

After streaming completes, the final accumulated text is synced to React state.
If the user switched to a different conversation mid-stream, the update is
skipped — the message is already saved to the database and will appear when
they switch back.

```ts
const finalText = streamingTextRef.current;
const messageConversationId = explicitConversationId;
const viewingConversationId = loadedConversationIdRef.current;

// Skip the state update if the user switched conversations mid-stream.
// The message is already saved to DB and will appear when they switch back.
if (messageConversationId && viewingConversationId && messageConversationId !== viewingConversationId) {
  // User switched away — no state update needed
} else {
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantMessageId
        ? { ...msg, parts: [{ type: "text", text: finalText }] }
        : msg
    )
  );
}
```
