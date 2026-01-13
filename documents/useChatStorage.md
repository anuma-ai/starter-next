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

## Sending Images

Images can be sent alongside text messages. They're added to the UI immediately
and sent to the API as `image_url` content parts.

### Adding Images to UI

When building message parts for optimistic UI updates, images are converted to
`image_url` parts while other files become `file` parts.

{@includeCode ../hooks/useAppChatStorage.ts#imagePartsUI}

### Building Image Content for API

The content array sent to the API uses the same structure, with images as
`image_url` and other files as `input_file`.

{@includeCode ../hooks/useAppChatStorage.ts#imageContentParts}

### Persisting Files

Files are stored in IndexedDB for persistence across sessions. The SDK receives
file metadata without the data URL (which would be stripped anyway).

{@includeCode ../hooks/useAppChatStorage.ts#fileStorage}

## Conversation Management

{@includeCode ../hooks/useAppChatStorage.ts#conversationManagement}
