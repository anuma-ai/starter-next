# Conversation management

The `useChatStorage` hook exposes methods for creating, switching between, and
deleting conversations. These are typically wired up to a sidebar or
conversation list component.

## Creating a Conversation

There are two modes: auto-create on first message (the default when
`autoCreateConversation: true` is set), or create immediately for cases like
navigating to a project page where you need a conversation ID upfront.

{@includeCode ../hooks/useAppChatStorage.ts#createConversation}

## Switching Conversations

Switching handles several edge cases: skipping redundant loads, caching
messages for conversations that are still streaming, and restoring cached
messages when switching back to a streaming conversation. Messages are preloaded
before the state update to prevent flicker.

{@includeCode ../hooks/useAppChatStorage.ts#switchConversation}

## Deleting a Conversation

{@includeCode ../hooks/useAppChatStorage.ts#deleteConversation}
