# Sending messages

The `useChatStorage` hook from `@reverbia/sdk/react` provides persistent chat
storage with WatermelonDB. It manages conversations, message history, and
streams responses from the API.

## Hook Initialization

Pass the values from the Setup page into `useChatStorage`. The hook returns
methods for sending messages, managing conversations, and working with files.
See Setup for how to obtain `database`, `getToken`, and the wallet fields.

{@includeCode ../hooks/useAppChatStorage.ts#hookInit}

## Optimistic UI Updates

Add messages to the UI immediately before the API responds. This creates a
snappy user experience by showing the user's message right away along with an
empty assistant placeholder that will be filled as the response streams in.

{@includeCode ../hooks/useAppChatStorage.ts#optimisticUpdate}

## Building Content Parts

While the optimistic update builds parts for the UI, the API payload needs a
different format. Text is the same, but files are included as content parts
in the messages array — images as `image_url`, other files as `input_file`
with stable IDs for matching during preprocessing. A separate `sdkFiles`
array provides metadata so the SDK can encrypt and store files in OPFS.

{@includeCode ../hooks/useAppChatStorage.ts#contentParts}

## Calling sendMessage

The content parts and an optional system prompt are assembled into a messages
array, then passed to `sendMessage`. The key options are `model`,
`temperature`, `reasoning` (for extended thinking), and `serverTools` and
`clientTools` (for tool use). Only provided options are included. The `onData`
callback streams text chunks to the UI as they arrive.

{@includeCode ../hooks/useAppChatStorage.ts#sendCall}

## Tool Calling

When client tools are provided and the model returns tool calls, a loop
executes them locally via the `onToolCall` callback and sends results back to
the model. `extractToolCalls` normalizes across Responses API, Chat Completions
API, and SDK-wrapped response formats. The loop runs up to 10 iterations to
handle chained tool calls.

{@includeCode ../hooks/useAppChatStorage.ts#toolCalling}

## Title Generation

After the first message, an LLM-generated title is created asynchronously
using `sendMessage` with `skipStorage: true` so the request isn't saved as a
conversation message.

{@includeCode ../hooks/useAppChatStorage.ts#titleGeneration}

## Post-Stream Cleanup

After streaming completes, the final accumulated text is synced to React state.
If the user switched to a different conversation mid-stream, the update is
skipped — the message is already saved to the database and will appear when
they switch back.

{@includeCode ../hooks/useAppChatStorage.ts#postStreamCleanup}
