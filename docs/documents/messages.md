# Sending messages

The `useChatStorage` hook from `@anuma/sdk/react` provides persistent chat
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
    stop,
    conversationId,
    getMessages,
    getConversation,
    getConversations,
    createConversation,
    setConversationId,
    deleteConversation,
    getAllFiles,
    createMemoryEngineTool,
    createMemoryVaultTool,
    createMemoryVaultSearchTool,
    vaultEmbeddingCache,
    getVaultMemories,
    createVaultMemory,
    updateVaultMemory,
    deleteVaultMemory,
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

[hooks/useAppChatStorage.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChatStorage.ts#L244-L278)

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

[hooks/useAppChatStorage.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChatStorage.ts#L566-L599)

## Building Content Parts

While the optimistic update builds parts for the UI, the API payload needs a
different format. Text is the same, but files are included as content parts
in the messages array as `image_url` content parts. Fireworks models
(Anuma) require the Chat Completions API for vision, so the hook
switches to `completions` when images are attached. Each file gets a
stable ID so the SDK can match it back to
extracted text after file preprocessing (see `preprocessFiles` in the SDK
docs). A separate `sdkFiles` array provides metadata so the SDK can encrypt
and store non-image files in OPFS.

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

      // Fireworks models require Chat Completions API for vision/images;
      // their Responses API doesn't support multimodal content.
      const hasImages = enrichedFiles.some((f) => f.mediaType?.startsWith("image/"));
      const effectiveApiType =
        model?.startsWith("fireworks/") && hasImages ? "completions" as const : apiType;

      // Images are sent as image_url content parts (Chat Completions format).
      // Non-image files (PDF, DOCX, XLSX, ZIP) are handled by the SDK's client-side
      // preprocessing via the files parameter below.
      enrichedFiles.forEach((file) => {
        if (file.mediaType?.startsWith("image/")) {
          contentParts.push({ type: "image_url", image_url: { url: file.url, detail: "high" } });
        }
      });

      // SDK file metadata — the SDK preprocesses non-image files (PDF, Word, Excel) automatically.
      // Images are already included as content parts above, so exclude them here.
      const sdkFiles = enrichedFiles
        .filter((file) => !file.mediaType?.startsWith("image/"))
        .map((file) => ({
          id: file.stableId,
          name: file.filename || file.stableId,
          type: file.mediaType || "application/octet-stream",
          size: 0,
          url: file.url,
        }));
```

[hooks/useAppChatStorage.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChatStorage.ts#L669-L705)

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

      // When files are attached, exclude UI interaction and display tools so
      // the model analyzes file contents directly instead of presenting
      // interactive menus or rendering charts/cards.
      const hasAttachments = sdkFiles.length > 0 || hasImages;
      const UI_INTERACTION_TOOLS = ["prompt_user_choice", "prompt_user_form", "display_chart", "display_weather"];
      const effectiveClientTools = hasAttachments && clientTools
        ? clientTools.filter((t: any) => {
            const toolName = t.function?.name || t.name;
            return !UI_INTERACTION_TOOLS.includes(toolName);
          })
        : clientTools;

      // See SendMessageWithStorageArgs in the SDK docs for the full list of options
      const sendArgs = {
        messages: messagesArray,
        model,
        includeHistory: true,
        ...(temperature !== undefined && { temperature }),
        ...(maxOutputTokens !== undefined && { maxOutputTokens }),
        ...(reasoning && { reasoning }),
        ...(sdkFiles && sdkFiles.length > 0 && { files: sdkFiles }),
        ...(serverTools && (typeof serverTools === "function" || serverTools.length > 0) && { serverTools }),
        ...(effectiveClientTools && effectiveClientTools.length > 0 && { clientTools: effectiveClientTools }),
        ...(clientToolsFilter && { clientToolsFilter }),
        ...(store !== undefined && { store }),
        ...(thinking && { thinking }),
        ...(onThinking && { onThinking }),
        ...(memoryContext && { memoryContext }),
        ...(toolChoice && { toolChoice }),
        ...(effectiveApiType && { apiType: effectiveApiType }),
        ...(explicitConversationId && { conversationId: explicitConversationId }),
        onData: (chunk: string) => {
          streamingTextRef.current += chunk;
          if (onStreamingData && loadedConversationIdRef.current === streamingConversationIdRef.current) {
            onStreamingData(chunk, streamingTextRef.current);
          }
        },
      };

      let response = await sendMessage(sendArgs);

      // Retry on transient failures:
      // 1. Empty responses — some models (e.g. Fireworks) intermittently return
      //    a successful SSE stream with no output text.
      // 2. Network errors — "Failed to fetch" can occur transiently in CI or
      //    under load. These are worth retrying.
      const isTransientError = (r: typeof response) => {
        if (!r?.error) return false;
        const e = r.error.toLowerCase();
        return e.includes("failed to fetch") || e.includes("fetch failed") ||
               e.includes("econnreset") || e.includes("econnrefused") ||
               e.includes("network");
      };
      // Retries should not re-preprocess files — the SDK extracts text and stores
      // files on the first call.  Re-sending with files causes duplicate storage
      // entries and wastes 10-30 s per file on redundant preprocessing.
      const retryArgs = sdkFiles.length > 0
        ? { ...sendArgs, files: undefined }
        : sendArgs;
      const MAX_RETRIES = 2;
      for (let retry = 0; retry < MAX_RETRIES; retry++) {
        if (stoppedRef.current) break;
        const hasAutoExecutedTools = (response as any)?.autoExecutedToolResults?.length > 0;
        const emptyResponse = !response?.error && !hasAutoExecutedTools && !streamingTextRef.current.trim();
        const transientError = isTransientError(response);
        if (!emptyResponse && !transientError) break;
        console.warn(`[useAppChatStorage] ${transientError ? "Transient error" : "Empty response"}, retrying (${retry + 1}/${MAX_RETRIES})`);
        streamingTextRef.current = "";
        response = await sendMessage(retryArgs);
      }
```

[hooks/useAppChatStorage.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChatStorage.ts#L713-L788)

## Stopping a Response

The SDK's `useChatStorage` returns a `stop` function that aborts the active
stream via an `AbortController`. Calling it cancels the HTTP request and the
SDK stores the partial response with `wasStopped: true`.

Because the SDK treats aborted requests as successful (returning
`{ error: null }`), the retry loop would interpret an early stop as an empty
response and re-send. A `stoppedRef` flag prevents this and also
short-circuits the tool calling loop. In the UI, conditionally render a stop
button when `isLoading` is true using a plain `<button type="button">` to
avoid triggering form submission.

```ts
  // Wrap SDK stop to also clear streaming state
  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    stop();

    // Clear streaming state so UI updates immediately
    streamingConversationIdRef.current = null;
    setStreamingConversationIdState(null);
    isSendingMessageRef.current = false;
  }, [stop]);
```

[hooks/useAppChatStorage.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChatStorage.ts#L553-L562)

## Tool Calling

Tool execution is handled entirely by the SDK's internal tool loop. Client
tools are passed to `sendMessage` with an `executor` function, and the SDK
automatically executes them, sends results back to the model, and continues
until the model stops calling tools or the iteration limit is reached.

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

[hooks/useAppChatStorage.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChatStorage.ts#L834-L869)

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

[hooks/useAppChatStorage.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChatStorage.ts#L814-L830)
