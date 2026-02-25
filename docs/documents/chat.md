# Chat Orchestration

The `useAppChat` hook is the top-level orchestrator that ties together message
sending, memory retrieval, the vault, streaming subscriptions, tool management,
and error handling. It wraps `useAppChatStorage` and adds the features
documented in their own pages into a single hook.

## Hook Initialization

The hook accepts configuration for the database, authentication, model
settings, encryption, tools, and optional callbacks. It composes the system
prompt from a base prompt plus vault instructions (when enabled), and passes
everything down to `useAppChatStorage`:

```ts
export function useAppChat({
  database,
  getToken,
  model = "openai/gpt-5.2-2025-12-11",
  temperature,
  maxOutputTokens,
  walletAddress,
  signMessage,
  embeddedWalletSigner,
  encryptionReady,
  serverTools,
  clientTools,
  clientToolsFilter,
  toolChoice,
  systemPrompt,
  onVaultSave,
}: UseAppChatProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  //#region memorySettings
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryLimit, setMemoryLimit] = useState(5);
  const [memoryThreshold, setMemoryThreshold] = useState(0.2);
  //#endregion memorySettings
  //#region vaultSettings
  const [vaultEnabled, setVaultEnabled] = useState(true);
  const [vaultSearchLimit, setVaultSearchLimit] = useState(5);
  const [vaultSearchThreshold, setVaultSearchThreshold] = useState(0.1);
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string | null>(null);
  const [customVaultPrompt, setCustomVaultPrompt] = useState<string | null>(null);
  //#endregion vaultSettings
  const streamingCallbacksRef = useRef<Set<(text: string) => void>>(new Set());
  const thinkingCallbacksRef = useRef<Set<(text: string) => void>>(new Set());
  const thinkingTextRef = useRef<string>("");

  //#region memorySettingsLoader
  // Load memory settings from localStorage
  useEffect(() => {
    const savedEnabled = localStorage.getItem("chat_memoryEnabled");
    if (savedEnabled !== null) {
      setMemoryEnabled(savedEnabled === "true");
    }

    const savedLimit = localStorage.getItem("chat_memoryLimit");
    if (savedLimit) {
      const limit = parseInt(savedLimit, 10);
      if (!isNaN(limit) && limit > 0) {
        setMemoryLimit(limit);
      }
    }

    const savedThreshold = localStorage.getItem("chat_memoryThreshold");
    if (savedThreshold) {
      const threshold = parseFloat(savedThreshold);
      if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
        setMemoryThreshold(threshold);
      }
    }

    const savedVaultEnabled = localStorage.getItem("chat_vaultEnabled");
    if (savedVaultEnabled !== null) {
      setVaultEnabled(savedVaultEnabled === "true");
    }

    const savedVaultSearchLimit = localStorage.getItem("chat_vaultSearchLimit");
    if (savedVaultSearchLimit) {
      const limit = parseInt(savedVaultSearchLimit, 10);
      if (!isNaN(limit) && limit > 0) {
        setVaultSearchLimit(limit);
      }
    }

    const savedVaultSearchThreshold = localStorage.getItem("chat_vaultSearchThreshold");
    if (savedVaultSearchThreshold) {
      const threshold = parseFloat(savedVaultSearchThreshold);
      if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
        setVaultSearchThreshold(threshold);
      }
    }

    const savedSystemPrompt = localStorage.getItem("chat_systemPrompt");
    if (savedSystemPrompt !== null) {
      setCustomSystemPrompt(savedSystemPrompt);
    }

    const savedVaultPrompt = localStorage.getItem("chat_vaultPrompt");
    if (savedVaultPrompt !== null) {
      setCustomVaultPrompt(savedVaultPrompt);
    }

    // Listen for changes from settings page
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "chat_memoryEnabled" && e.newValue !== null) {
        setMemoryEnabled(e.newValue === "true");
      }
      if (e.key === "chat_memoryLimit" && e.newValue) {
        const limit = parseInt(e.newValue, 10);
        if (!isNaN(limit) && limit > 0) {
          setMemoryLimit(limit);
        }
      }
      if (e.key === "chat_memoryThreshold" && e.newValue) {
        const threshold = parseFloat(e.newValue);
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
          setMemoryThreshold(threshold);
        }
      }
      if (e.key === "chat_vaultEnabled" && e.newValue !== null) {
        setVaultEnabled(e.newValue === "true");
      }
      if (e.key === "chat_vaultSearchLimit" && e.newValue) {
        const limit = parseInt(e.newValue, 10);
        if (!isNaN(limit) && limit > 0) {
          setVaultSearchLimit(limit);
        }
      }
      if (e.key === "chat_vaultSearchThreshold" && e.newValue) {
        const threshold = parseFloat(e.newValue);
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
          setVaultSearchThreshold(threshold);
        }
      }
      if (e.key === "chat_systemPrompt") {
        setCustomSystemPrompt(e.newValue);
      }
      if (e.key === "chat_vaultPrompt") {
        setCustomVaultPrompt(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
  //#endregion memorySettingsLoader

  // Callback to handle streaming data from chat storage
  const handleStreamingData = useCallback(
    (_chunk: string, accumulated: string) => {
      // Notify all subscribers for direct DOM updates (bypasses React batching)
      streamingCallbacksRef.current.forEach((callback) => callback(accumulated));
    },
    []
  );

  // Callback to handle thinking/reasoning data
  const handleThinkingData = useCallback((accumulated: string) => {
    thinkingCallbacksRef.current.forEach((callback) => callback(accumulated));
  }, []);

  // Use chat storage for message persistence and memory retrieval
  const {
    messages,
    setMessages,
    conversations,
    conversationId,
    isLoading,
    sendMessage: baseSendMessage,
    addMessageOptimistically,
    createConversation,
    switchConversation,
    setConversationId,
    deleteConversation,
    refreshConversations,
    getMessages,
    getConversation,
    createMemoryRetrievalTool,
    createMemoryVaultTool,
    createMemoryVaultSearchTool,
    vaultEmbeddingCache,
    getVaultMemories,
    createVaultMemory,
    updateVaultMemory,
    deleteVaultMemory,
    stop,
  } = useAppChatStorage({
    database,
    getToken,
    onStreamingData: handleStreamingData,
    // Enable encrypted file storage in OPFS when wallet is connected
    walletAddress,
    signMessage,
    embeddedWalletSigner,
    // Re-load messages when encryption becomes ready (to decrypt file attachments)
    encryptionReady,
    // Compose system prompt: base prompt + vault instructions (when enabled)
    systemPrompt: [
      customSystemPrompt || systemPrompt || DEFAULT_SYSTEM_PROMPT,
      vaultEnabled ? (customVaultPrompt ?? DEFAULT_VAULT_PROMPT) : "",
    ].filter(Boolean).join("\n\n"),
  });

  // Use tools hook for checksum-based refresh
  const { checkForUpdates } = useTools({
    getToken,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  });
```

## Sending a Message

The `sendMessage` function coordinates several concerns on each call:

1. Resets the thinking text accumulator
2. Merges tools from hook-level props and per-request options
3. Ensures a conversation ID exists (creating one if needed)
4. Builds the client tools array: memory retrieval + vault + caller-provided
   tools
5. Calls the underlying `baseSendMessage` with all options
6. Checks the response for a `tools_checksum` and auto-refreshes server tools
   if the set has changed

```ts
const sendMessage = useCallback(
  async (
    text: string,
    options?: {
      model?: string;
      temperature?: number;
      maxOutputTokens?: number;
      // #region reasoningOptions
      reasoning?: { effort?: string; summary?: string };
      thinking?: { type?: string; budget_tokens?: number };
      // #endregion reasoningOptions
      onThinking?: (chunk: string) => void;
      files?: FileUIPart[];
      displayText?: string;
      skipOptimisticUpdate?: boolean;
      serverTools?: ServerToolsFilter;
      clientTools?: any[];
      toolChoice?: string;
      apiType?: "responses" | "completions";
      /** Explicitly specify the conversation ID to send this message to */
      conversationId?: string;
      /** Callback when tool calls are received - used for client-side tool execution */
      onToolCall?: (toolCall: { id: string; name: string; arguments: Record<string, any> }, clientTools: any[]) => Promise<any>;
      /** Flag to indicate this is the first message - used for title generation */
      isFirstMessage?: boolean;
    }
  ) => {
    setError(null);
    const effectiveModel = options?.model || model;
    const effectiveTemperature = options?.temperature ?? temperature;
    const effectiveMaxOutputTokens =
      options?.maxOutputTokens ?? maxOutputTokens;

    try {
      // Reset thinking accumulator
      thinkingTextRef.current = "";

      // Create onThinking handler that accumulates and notifies
      const onThinking = (chunk: string) => {
        thinkingTextRef.current += chunk;
        handleThinkingData(thinkingTextRef.current);
      };

      // Merge tools from hook props and per-request options
      // Memory retrieval tool is automatically included for on-demand memory fetching
      const effectiveServerTools = options?.serverTools || serverTools;
      const baseClientTools = options?.clientTools || clientTools || [];

      //#region memoryToolCreation
      // Ensure we have a conversation ID BEFORE creating the memory tool
      // This is critical for excludeConversationId to work on new conversations
      let effectiveConversationId = options?.conversationId || conversationId;
      if (!effectiveConversationId) {
        // Create a new conversation first so we have an ID to exclude
        // Pass createImmediately to actually create the conversation now (not on first message)
        const newConv = await createConversation({ createImmediately: true });
        if (newConv) {
          effectiveConversationId = newConv.conversationId;
        }
      }

      // Build client tools: memory retrieval + memory vault + base tools
      const builtInTools: any[] = [];

      if (memoryEnabled) {
        builtInTools.push(
          createMemoryRetrievalTool({
            limit: memoryLimit,
            minSimilarity: memoryThreshold,
            excludeConversationId: effectiveConversationId ?? undefined,
          })
        );
      }

      //#region vaultToolCreation
      if (vaultEnabled) {
        // Wrap onVaultSave to eagerly embed content at save time
        const wrappedOnVaultSave = async (operation: VaultSaveOperation) => {
          try {
            await eagerEmbedContent(
              operation.content,
              { getToken, baseUrl: process.env.NEXT_PUBLIC_API_URL },
              vaultEmbeddingCache
            );
          } catch {
            // Non-critical: embedding will be generated on next search
          }
          return onVaultSave ? onVaultSave(operation) : true;
        };

        builtInTools.push(
          createMemoryVaultTool({
            onSave: wrappedOnVaultSave,
          })
        );
        builtInTools.push(createMemoryVaultSearchTool({
          limit: vaultSearchLimit,
          minSimilarity: vaultSearchThreshold,
        }));
      }
      //#endregion vaultToolCreation

      const effectiveClientTools = [...builtInTools, ...baseClientTools];
      //#endregion memoryToolCreation
      const effectiveToolChoice = options?.toolChoice || toolChoice;
      const response = await baseSendMessage(text, {
        model: effectiveModel,
        temperature: effectiveTemperature,
        maxOutputTokens: effectiveMaxOutputTokens,
        ...(options?.reasoning && { reasoning: options.reasoning }),
        ...(options?.thinking && { thinking: options.thinking }),
        ...(options?.files && { files: options.files }),
        displayText: options?.displayText || text, // Show original text in UI
        ...(options?.skipOptimisticUpdate !== undefined && {
          skipOptimisticUpdate: options.skipOptimisticUpdate,
        }),
        ...(effectiveServerTools && { serverTools: effectiveServerTools }),
        ...(effectiveClientTools && { clientTools: effectiveClientTools }),
        ...(clientToolsFilter && { clientToolsFilter }),
        ...(effectiveToolChoice && { toolChoice: effectiveToolChoice }),
        ...(options?.apiType && { apiType: options.apiType }),
        // Always pass the effectiveConversationId (either from options, hook state, or newly created)
        conversationId: effectiveConversationId ?? undefined,
        ...(options?.onToolCall && { onToolCall: options.onToolCall }),
        ...(options?.isFirstMessage !== undefined && { isFirstMessage: options.isFirstMessage }),
        onThinking,
      });

      // Check if the SDK returned an error in the result object
      if (response?.error) {
        setError(response.error);
        return { ...response, conversationId: effectiveConversationId };
      }

      // Auto-refresh tools if server tools changed
      // Both Responses API and Completions API formats include tools_checksum
      const toolsChecksum = (response?.data as { tools_checksum?: string })?.tools_checksum;
      if (toolsChecksum) {
        const needsRefresh = checkForUpdates(toolsChecksum);
        if (needsRefresh) {
          console.log("[APPCHAT] Tools checksum changed, refreshing tools");
        } else {
          console.log("[APPCHAT] Tools are up to date");
        }
      }

      // Return both the response and the conversation ID for navigation
      return { ...response, conversationId: effectiveConversationId };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
      throw err;
    }
  },
  [
    baseSendMessage,
    model,
    temperature,
    maxOutputTokens,
    handleThinkingData,
    createMemoryRetrievalTool,
    createMemoryVaultTool,
    createMemoryVaultSearchTool,
    vaultEmbeddingCache,
    createConversation,
    memoryEnabled,
    memoryLimit,
    memoryThreshold,
    vaultEnabled,
    vaultSearchLimit,
    vaultSearchThreshold,
    onVaultSave,
    conversationId,
    serverTools,
    clientTools,
    clientToolsFilter,
    toolChoice,
    checkForUpdates,
  ]
);

const handleSubmit = useCallback(
  async (
    message: { text?: string; files?: FileUIPart[]; displayText?: string },
    options?: {
      model?: string;
      temperature?: number;
      maxOutputTokens?: number;
      reasoning?: { effort?: string; summary?: string };
      thinking?: { type?: string; budget_tokens?: number };
      onThinking?: (chunk: string) => void;
      skipOptimisticUpdate?: boolean;
      apiType?: "responses" | "completions";
      /** Explicitly specify the conversation ID to send this message to */
      conversationId?: string;
      /** Flag to indicate this is the first message - used for title generation */
      isFirstMessage?: boolean;
    }
  ) => {
    if (!message.text) {
      return;
    }

    // Only clear input if we haven't already done it optimistically
    if (!options?.skipOptimisticUpdate) {
      setInput("");
    }
    const result = await sendMessage(message.text, {
      ...options,
      files: message.files,
      displayText: message.displayText,
      skipOptimisticUpdate: options?.skipOptimisticUpdate,
      conversationId: options?.conversationId,
      isFirstMessage: options?.isFirstMessage,
    });
    return result;
  },
  [sendMessage, setInput]
);

//#region streamingSubscriptions
const subscribeToStreaming = useCallback(
  (callback: (text: string) => void) => {
    streamingCallbacksRef.current.add(callback);
    return () => {
      streamingCallbacksRef.current.delete(callback);
    };
  },
  []
);

const subscribeToThinking = useCallback(
  (callback: (text: string) => void) => {
    thinkingCallbacksRef.current.add(callback);
    return () => {
      thinkingCallbacksRef.current.delete(callback);
    };
  },
  []
);
//#endregion streamingSubscriptions
```

## Memory and Vault

Memory retrieval and the vault are injected as client tools on each
`sendMessage` call. When disabled, the respective tools are simply omitted.
See [Memory Retrieval](memory/retrieval) and [Memory Vault](memory/vault) for details.

## Streaming

The hook provides `subscribeToStreaming` and `subscribeToThinking` for
low-latency DOM updates during streaming. See [Streaming
Subscriptions](streaming) for the pattern.

## Return Value

The hook returns everything from `useAppChatStorage` plus input state,
streaming subscriptions, and vault CRUD:

```ts
return {
  // Chat state
  messages,
  setMessages,
  conversations,
  conversationId,
  isLoading,
  error,
  input,
  setInput,
  status,

  // Chat actions
  sendMessage,
  handleSubmit,
  addMessageOptimistically,
  createConversation,
  switchConversation,
  setConversationId,
  deleteConversation,
  refreshConversations,
  subscribeToStreaming,
  subscribeToThinking,
  getMessages,
  getConversation,
  stop,

  //#region vaultReturn
  // Memory vault
  getVaultMemories,
  createVaultMemory,
  updateVaultMemory,
  deleteVaultMemory,
  //#endregion vaultReturn
};
```
