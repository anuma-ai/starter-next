# Streaming Subscriptions

The `useAppChat` hook provides a pub/sub system for streaming text updates
that bypasses React's state batching. This is important for chat UIs where
you want to render tokens as they arrive without waiting for React to batch
and flush state updates.

## The Problem

During streaming, the SDK fires `onData` callbacks rapidly (often 10–50 times
per second). Updating React state on each callback triggers re-renders that
can't keep up, causing visible lag and dropped frames. The streaming text
appears to update in chunks rather than smoothly.

## The Solution

Instead of updating React state on each token, `useAppChat` accumulates the
streamed text in a ref and notifies subscribers through a callback set. Each
subscriber can update the DOM directly (e.g. setting `textContent` on a ref)
without going through React's reconciliation:

```ts
  const subscribeToStreaming = useCallback(
    (callback: (text: string) => void) => {
      streamingCallbacksRef.current.add(callback);
      return () => {
        streamingCallbacksRef.current.delete(callback);
      };
    },
    []
  );

  const subscribeToThinking = useCallback(
    (callback: (text: string) => void) => {
      thinkingCallbacksRef.current.add(callback);
      return () => {
        thinkingCallbacksRef.current.delete(callback);
      };
    },
    []
  );
```

[hooks/useAppChat.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L493-L511)

## Usage

Subscribe from your chat message component. The callback receives the full
accumulated text (not individual chunks), so you can replace the element's
content directly:

```tsx
const contentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const unsubscribe = subscribeToStreaming((text) => {
    if (contentRef.current) {
      contentRef.current.textContent = text;
    }
  });
  return unsubscribe;
}, [subscribeToStreaming]);
```

For markdown rendering, you'd parse and render the accumulated text on each
callback. The key advantage is that the callback fires synchronously — there's
no React render cycle between the token arriving and the DOM updating.

## Thinking Subscriptions

The same pattern applies to thinking/reasoning tokens via
`subscribeToThinking`. See [Thinking Mode](thinking) for details.

## When to Use React State Instead

After streaming completes, the final text is synced to React state in the
post-stream cleanup phase (see [Sending Messages](messages)). The streaming
subscription is only needed during active streaming — once the response is
complete, the message is available through the normal `messages` array.
