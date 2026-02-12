# Sending messages

The `useChatStorage` hook from `@reverbia/sdk/react` provides persistent chat
storage with WatermelonDB. It manages conversations, message history, and
streams responses from the API.

## Hook Initialization

{@includeCode ../hooks/useAppChatStorage.ts#hookInit}

## Optimistic UI Updates

Add messages to the UI immediately before the API responds. This creates a
snappy user experience by showing the user's message right away along with an
empty assistant placeholder that will be filled as the response streams in.

{@includeCode ../hooks/useAppChatStorage.ts#optimisticUpdate}

## Building Content Parts

Content parts are assembled for the SDK. Text is added first, then files are
enriched with stable IDs. Images become `image_url` parts, other files become
`input_file` parts. File metadata is also passed to the SDK for encrypted OPFS
storage.

{@includeCode ../hooks/useAppChatStorage.ts#contentParts}

## Calling sendMessage

The send handler destructures its options, triggers the optimistic update, then
calls the SDK. Options like `temperature`, `reasoning`, `serverTools`, and
`clientTools` are conditionally spread so only provided values are sent. The
`onData` callback accumulates streamed text and notifies subscribers.

{@includeCode ../hooks/useAppChatStorage.ts#sendCall}

## Tool Calling

When client tools are configured and the response contains tool calls, a
multi-turn loop executes them. The loop detects tool calls across multiple API
response formats (Responses API, Chat Completions API, SDK-wrapped formats),
runs each tool via the `onToolCall` callback, and sends results back as a
continuation message.

{@includeCode ../hooks/useAppChatStorage.ts#toolCalling}

## Title Generation

On the first message in a conversation, a temporary title is set from the
user's text immediately so the sidebar shows something meaningful. After the
response completes, an LLM-generated title replaces it asynchronously using
`sendMessage` with `skipStorage: true`.

{@includeCode ../hooks/useAppChatStorage.ts#titleGeneration}

## Post-Stream Cleanup

After streaming completes, the final accumulated text is synced to React state.
If the user switched to a different conversation mid-stream, the update is
skipped — the message is already saved to the database and will appear when
they switch back. Streaming refs and caches are then cleared.

{@includeCode ../hooks/useAppChatStorage.ts#postStreamCleanup}
