# Chat

`useAppChat` is the main hook for adding chat to your app. It wraps the SDK's
storage layer and wires in memory, vault, streaming, and tools so you get a
single hook that handles the full lifecycle of a conversation.

## Props

Pass in the values from the [Setup](setup) page along with any tools and model
configuration.

{@includeCode ../hooks/useAppChat.ts#chatProps}

## Sending a Message

Call `sendMessage` with the user's input. The hook creates a conversation if
one doesn't exist yet, injects any configured memory and vault tools alongside
your own, and streams the response back. Per-message overrides for model,
temperature, tools, reasoning, and file attachments can be passed as a second
argument. See [Sending Messages](messages) for the full implementation.

## Return Value

The hook returns chat state, streaming subscriptions, and vault operations.

{@includeCode ../hooks/useAppChat.ts#chatReturnValue}

## What's Next

Each feature the hook composes has its own page with implementation details:

- [Sending Messages](messages) — optimistic UI, content parts, tool calling,
  and the lower-level `useAppChatStorage` hook
- [Streaming](streaming) — `subscribeToStreaming` and `subscribeToThinking`
  for real-time DOM updates
- [Memory Engine](memory/retrieval) and [Vault](memory/vault) — how
  long-term memory and encrypted storage are injected as client tools
- [Tools](tools) — server tools, client tools, and how tool sets are managed
