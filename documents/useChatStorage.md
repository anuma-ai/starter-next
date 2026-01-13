# Sending messages

The `useChatStorage` hook from `@reverbia/sdk/react` provides persistent chat
storage with WatermelonDB. It manages conversations, message history, and
handles syncing between local storage and the server.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

## Hook Initialization

{@includeCode ../hooks/useAppChatStorage.ts#hookInit}

## Sending Messages

### Optimistic UI Updates

Add messages to the UI immediately before the API responds. This creates a
snappy user experience by showing the user's message right away along with an
empty assistant placeholder that will be filled as the response streams in.

{@includeCode ../hooks/useAppChatStorage.ts#optimisticUpdate}

### Handling the Send

The main handler builds content parts, stores files in IndexedDB for
persistence, and calls the SDK's `sendMessage` with streaming support.

{@includeCode ../hooks/useAppChatStorage.ts#handleSend}

## Conversation Management

{@includeCode ../hooks/useAppChatStorage.ts#conversationManagement}
