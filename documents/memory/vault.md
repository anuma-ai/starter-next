# Memory Vault

The memory vault is a persistent knowledge store that complements the
conversation-based memory retrieval system. While memory retrieval searches
across past conversation chunks, the vault stores curated facts and
preferences explicitly — things like "I'm vegetarian" or "my timezone is
PST". Vault entries persist independently of conversations and can be managed
directly by the user.

## How It Works

The vault operates through two client-side tools injected alongside the memory
retrieval tool:

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

{@includeCode ../../hooks/useAppChat.ts#vaultSettings}

Default values and ranges are visible in the code above. `vaultSearchThreshold`
is lower than memory retrieval's threshold because vault entries are typically
short and precise.

## System Prompt

When the vault is enabled, additional instructions are appended to the system
prompt telling the AI how to use the vault tools:

{@includeCode ../../hooks/useAppChat.ts#vaultPrompt}

This prompt can be overridden by setting `customVaultPrompt` in
`localStorage`.

## Creating Vault Tools

On each `sendMessage` call, vault tools are created with the current settings
and added to the client tools array alongside the memory retrieval tool. If
the vault is disabled, the tools are simply omitted.

The save tool wraps the caller's `onVaultSave` callback with eager embedding
— when a memory is saved, its content is immediately embedded via
`eagerEmbedContent` so subsequent searches can find it without waiting for
background processing.

{@includeCode ../../hooks/useAppChat.ts#vaultToolCreation}

## CRUD Operations

The hook exposes methods for direct vault management, typically wired to a
settings page where users can view, edit, and delete their stored memories:

{@includeCode ../../hooks/useAppChat.ts#vaultReturn}
