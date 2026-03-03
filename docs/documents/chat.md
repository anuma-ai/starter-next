# Chat

`useAppChat` is the main hook for adding chat to your app. It wraps the SDK's
storage layer and wires in memory, vault, streaming, and tools so you get a
single hook that handles the full lifecycle of a conversation.

## Props

Pass in the values from the [Setup](setup) page along with any tools and model
configuration.

```ts
type UseAppChatProps = {
  database: Database;
  getToken: () => Promise<string | null>;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  store?: boolean;
  // Wallet address for encrypted file storage
  walletAddress?: string;
  // Sign a message with the user's wallet
  signMessage?: (message: string) => Promise<string>;
  // Sign a message silently using the embedded wallet
  embeddedWalletSigner?: (message: string) => Promise<string>;
  // Whether encryption is ready (for reloading files after encryption initializes)
  encryptionReady?: boolean;
  // Server-side tools (tool names or dynamic filter function)
  serverTools?: ServerToolsFilter;
  // Client-side tools (with local executors)
  clientTools?: any[];
  // Dynamic filter for client tools based on prompt embeddings
  clientToolsFilter?: ClientToolsFilterFn;
  toolChoice?: string;
  // System prompt for the AI
  systemPrompt?: string;
  // Callback when the vault tool wants to save a memory (for confirmation UI)
  onVaultSave?: (operation: VaultSaveOperation) => Promise<boolean>;
};
```

[hooks/useAppChat.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L24-L50)

## Sending a Message

Call `sendMessage` with the user's input. The hook creates a conversation if
one doesn't exist yet, injects any configured memory and vault tools alongside
your own, and streams the response back. Per-message overrides for model,
temperature, tools, reasoning, and file attachments can be passed as a second
argument. See [Sending Messages](messages) for the full implementation.

## Return Value

The hook returns chat state, streaming subscriptions, and vault operations.

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

    // Memory vault
    getVaultMemories,
    createVaultMemory,
    updateVaultMemory,
    deleteVaultMemory,
  };
```

[hooks/useAppChat.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L518-L552)

## What's Next

Each feature the hook composes has its own page with implementation details:

- [Sending Messages](messages) — optimistic UI, content parts, tool calling,
  and the lower-level `useAppChatStorage` hook
- [Streaming](streaming) — `subscribeToStreaming` and `subscribeToThinking`
  for real-time DOM updates
- [Memory Engine](memory/retrieval) and [Vault](memory/vault) — how
  long-term memory and encrypted storage are injected as client tools
- [Tools](tools) — server tools, client tools, and how tool sets are managed
