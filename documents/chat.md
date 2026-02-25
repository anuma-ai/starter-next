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

{@includeCode ../hooks/useAppChat.ts#hookInit}

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

{@includeCode ../hooks/useAppChat.ts#sendMessage}

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

{@includeCode ../hooks/useAppChat.ts#returnValue}
