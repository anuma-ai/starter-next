# Sending messages

The `useChatStorage` hook from `@reverbia/sdk/react` provides persistent chat
storage with WatermelonDB. It manages conversations, message history, and
streams responses from the API.

## Setup

The hook expects a few values from your app's providers. `database` is a
WatermelonDB instance created with `useDatabaseManager` from the SDK and
exposed via React context:

```ts
// Create a WatermelonDB instance scoped to the user's wallet address.
// Expose via React context so hooks can access it with useDatabase().
export function setupDatabase() {
  const { user } = usePrivy();
  const database = useDatabaseManager(user?.wallet?.address, dbManager);
  return database;
}
```

`getToken` returns a Privy identity token. It caches the token from
`useIdentityToken()` and refreshes it when the JWT expires, avoiding redundant
API calls:

```ts
// Cache the Privy identity token and refresh when the JWT expires.
// This avoids calling Privy's standalone getIdentityToken() on every
// request (which hits /api/v1/users/me each time).
export function setupGetToken() {
  const { identityToken } = useIdentityToken();
  const identityTokenRef = useRef(identityToken);
  const tokenWaitersRef = useRef<Array<(token: string | null) => void>>([]);

  useEffect(() => {
    identityTokenRef.current = identityToken;
    if (identityToken && tokenWaitersRef.current.length > 0) {
      for (const resolve of tokenWaitersRef.current) resolve(identityToken);
      tokenWaitersRef.current = [];
    }
  }, [identityToken]);

  const getToken = useCallback(async (): Promise<string | null> => {
    const cached = identityTokenRef.current;
    if (cached) {
      try {
        const payload = JSON.parse(atob(cached.split(".")[1]));
        if (payload.exp && payload.exp * 1000 > Date.now() + 30_000) {
          return cached;
        }
      } catch {
        // Fall through to refresh
      }
      try {
        const fresh = await fetchIdentityToken();
        if (fresh) {
          identityTokenRef.current = fresh;
          return fresh;
        }
      } catch {
        // Network error — fall through to waiter
      }
    }
    return new Promise((resolve) => {
      tokenWaitersRef.current.push(resolve);
      setTimeout(() => {
        tokenWaitersRef.current = tokenWaitersRef.current.filter(
          (r) => r !== resolve
        );
        resolve(identityTokenRef.current);
      }, 10_000);
    });
  }, []);

  return getToken;
}
```

`walletAddress` and the signing functions come from Privy's auth hooks.
`signMessage` prompts the user to sign (used to derive an encryption key),
while `embeddedWalletSigner` signs silently via Privy's embedded wallet:

```ts
// Get wallet address and signing functions from Privy.
// signMessage prompts the user; embeddedWalletSigner signs silently.
export function setupWallet() {
  const { user, signMessage: privySignMessage } = usePrivy();
  const { wallets } = useWallets();

  const walletAddress = user?.wallet?.address;

  const signMessage = useCallback(
    async (message: string) => {
      const result = await privySignMessage(
        { message },
        { uiOptions: { showWalletUIs: false } }
      );
      return result.signature;
    },
    [privySignMessage]
  );

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const embeddedWalletSigner = useCallback(
    async (message: string) => {
      if (!embeddedWallet?.address) throw new Error("Embedded wallet not ready");
      const result = await privySignMessage(
        { message },
        { uiOptions: { showWalletUIs: false } }
      );
      return result.signature;
    },
    [embeddedWallet, privySignMessage]
  );

  return { walletAddress, signMessage, embeddedWalletSigner };
}
```

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
// Create SDK files - SDK handles encrypted storage automatically
const sdkFiles = enrichedFiles.map((file) => ({
  id: file.stableId,
  name: file.filename || file.stableId,
  type: file.mediaType || "application/octet-stream",
  size: 0,
  url: file.url, // SDK will encrypt and store in OPFS
}));
```

## Calling sendMessage

The send handler destructures its options, triggers the optimistic update, then
calls the SDK. Options like `temperature`, `reasoning`, `serverTools`, and
`clientTools` are conditionally spread so only provided values are sent. The
`onData` callback accumulates streamed text and notifies subscribers.

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
  let currentResponse: any = response;
  let iteration = 0;

  while (iteration++ < 10) {
    const toolCalls = extractToolCalls(currentResponse);
    if (toolCalls.length === 0) break;

    // Execute all tool calls and collect results
    const toolResults: Array<{ call_id: string; output: string }> = [];

    for (const call of toolCalls) {
      try {
        const rawArgs = call.arguments !== undefined ? call.arguments : call.function?.arguments;
        const toolCall: ToolCall = {
          id: call.id || call.call_id || `call_${Date.now()}`,
          name: call.name || call.function?.name,
          arguments: safeParseArgs(rawArgs),
        };

        const result = await onToolCall(toolCall, clientTools);
        toolResults.push({
          call_id: toolCall.id,
          output: JSON.stringify(result),
        });
      } catch (error) {
        toolResults.push({
          call_id: call.id || call.call_id || `call_${Date.now()}`,
          output: JSON.stringify({ error: String(error) }),
        });
      }
    }

    // Format tool results as a context message for the AI
    const toolResultsSummary = toolResults.map((tr) => {
      const toolName = toolCalls.find(c => (c.id || c.call_id) === tr.call_id)?.name || 'unknown';
      return `Tool "${toolName}" returned: ${tr.output}`;
    }).join('\n\n');

    const continuationPrompt = `[Tool Execution Results]\nThe following tools were executed:\n\n${toolResultsSummary}\n\nBased on these results, continue with the task.`;

    try {
      // Send results back via SDK to maintain conversation context
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
          const isViewingStreamingConversation =
            loadedConversationIdRef.current === streamingConversationIdRef.current;
          if (onStreamingData && isViewingStreamingConversation) {
            onStreamingData(chunk, streamingTextRef.current);
          }
        },
      });
    } catch (error) {
      break;
    }
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
