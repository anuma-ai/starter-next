# Memory Vault

The memory vault is a persistent knowledge store that complements the
conversation-based memory engine system. While the memory engine searches
across past conversation chunks, the vault stores curated facts and
preferences explicitly — things like "I'm vegetarian" or "my timezone is
PST". Vault entries persist independently of conversations and can be managed
directly by the user.

## How It Works

The vault operates through two client-side tools injected alongside the memory
engine tool:

- `memory_vault_search` — semantic similarity search across stored vault
  entries. The AI calls this to check if a related memory already exists
  before saving.
- `memory_vault_save` — creates or updates a vault entry. When an `id` is
  provided, the existing entry is updated instead of creating a duplicate.

The system prompt instructs the AI to always search before saving, and to
merge new information into existing entries to keep the vault compact.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token (for embedding
  generation)

## Vault Settings

Three settings control vault behavior, persisted in `localStorage` alongside
the memory settings:

```ts
  const [vaultEnabled, setVaultEnabled] = useState(true);
  const [vaultSearchLimit, setVaultSearchLimit] = useState(5);
  const [vaultSearchThreshold, setVaultSearchThreshold] = useState(0.1);
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string | null>(null);
  const [customVaultPrompt, setCustomVaultPrompt] = useState<string | null>(null);
```

[hooks/useAppChat.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L96-L100)

Default values and ranges are visible in the code above. `vaultSearchThreshold`
is lower than the memory engine's threshold because vault entries are typically
short and precise.

## System Prompt

When the vault is enabled, additional instructions are appended to the system
prompt telling the AI how to use the vault tools:

```ts
// Default vault instructions appended when the vault is enabled
const DEFAULT_VAULT_PROMPT = `You also have access to a memory vault for storing important facts and preferences the user shares. The vault has two tools:
- memory_vault_search: Search existing vault memories by semantic similarity. Returns matching entries with their IDs.
- memory_vault_save: Save or update a vault memory. Pass an "id" to update an existing entry.

IMPORTANT — vault workflow:
- When the user tells you something worth remembering, ALWAYS call memory_vault_search first to check if a related memory already exists.
- If memory_vault_search returns a related entry, use its id with memory_vault_save to UPDATE it rather than creating a duplicate. Merge the new information into the existing text.
- Only omit the "id" parameter when memory_vault_search confirms no existing entry is related.
- The vault should stay compact: one entry per topic, updated over time.
- When answering questions that might involve stored preferences or facts, call memory_vault_search to check.`;
```

[hooks/useAppChat.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L57-L67)

This prompt can be overridden by setting `customVaultPrompt` in
`localStorage`.

## Creating Vault Tools

On each `sendMessage` call, vault tools are created with the current settings
and added to the client tools array alongside the memory engine tool. If
the vault is disabled, the tools are simply omitted.

The save tool wraps the caller's `onVaultSave` callback with eager embedding
— when a memory is saved, its content is immediately embedded via
`eagerEmbedContent` so subsequent searches can find it without waiting for
background processing.

```ts
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
```

[hooks/useAppChat.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L344-L368)

## CRUD Operations

The hook exposes methods for direct vault management, typically wired to a
settings page where users can view, edit, and delete their stored memories:

```ts
    // Memory vault
    getVaultMemories,
    createVaultMemory,
    updateVaultMemory,
    deleteVaultMemory,
```

[hooks/useAppChat.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L545-L549)
