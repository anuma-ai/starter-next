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
in the messages array as `image_url` content parts. Fireworks models
(Anuma) require the Chat Completions API for vision, so the hook
switches to `completions` when images are attached. Each file gets a
stable ID so the SDK can match it back to
extracted text after file preprocessing (see `preprocessFiles` in the SDK
docs). A separate `sdkFiles` array provides metadata so the SDK can encrypt
and store non-image files in OPFS.

{@includeCode ../hooks/useAppChatStorage.ts#contentParts}

## Calling sendMessage

The content parts and an optional system prompt are assembled into a messages
array, then passed to `sendMessage`. Each option is conditionally spread so
only provided values are sent. The `onData` callback streams text chunks to
the UI as they arrive. See `SendMessageWithStorageArgs` in the SDK docs for
the full list of options.

{@includeCode ../hooks/useAppChatStorage.ts#sendCall}

## Stopping a Response

The SDK's `useChatStorage` returns a `stop` function that aborts the active
stream via an `AbortController`. Calling it cancels the HTTP request and the
SDK stores the partial response with `wasStopped: true`.

Because the SDK treats aborted requests as successful (returning
`{ error: null }`), the retry loop would interpret an early stop as an empty
response and re-send. A `stoppedRef` flag prevents this and also
short-circuits the tool calling loop. In the UI, conditionally render a stop
button when `isLoading` is true using a plain `<button type="button">` to
avoid triggering form submission.

{@includeCode ../hooks/useAppChatStorage.ts#stopResponse}

## Tool Calling

When client tools are provided and the model returns tool calls, a loop
executes them locally via the `onToolCall` callback and sends results back to
the model. The loop runs up to 10 iterations to handle chained tool calls.
`extractToolCalls` and `safeParseArgs` are app-level helpers that normalize
tool call formats across the Responses API, Chat Completions API, and
SDK-wrapped responses.

{@includeCode ../hooks/useAppChatStorage.ts#toolCalling}

## Title Generation

After the first message, an LLM-generated title is created asynchronously
using `sendMessage` with `skipStorage: true` so the title request isn't saved
as a conversation message. `extractTextFromResponse` and
`storeConversationTitle` are app-level helpers — the SDK provides
`updateConversationTitle` on the hook result for the same purpose.

{@includeCode ../hooks/useAppChatStorage.ts#titleGeneration}

## Post-Stream Cleanup

After streaming completes, the final accumulated text is synced to React state.
If the user switched to a different conversation mid-stream, the update is
skipped — the message is already saved to the database and will appear when
they switch back.

{@includeCode ../hooks/useAppChatStorage.ts#postStreamCleanup}
