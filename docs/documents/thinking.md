# Thinking Mode

Thinking mode enables extended reasoning, where the model "thinks" before
responding. The thinking tokens stream separately from the response text,
allowing you to display a reasoning panel or indicator while the model works
through complex problems.

## Two Reasoning Formats

The `sendMessage` function supports two reasoning parameter formats depending
on the model provider — `reasoning` for OpenAI-compatible models and `thinking`
for Anthropic models:

```ts
        reasoning?: { effort?: string; summary?: string };
        thinking?: { type?: string; budget_tokens?: number };
```

[hooks/useAppChat.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L279-L280)

Pass one or the other in the options object. Both are forwarded to the SDK and
included in the API request; only the parameter matching the model provider has
any effect.

## Streaming Thinking Tokens

Thinking tokens stream through a separate callback. The `useAppChat` hook
accumulates them and notifies subscribers via a pub/sub pattern that bypasses
React's batching for low-latency DOM updates:

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

[hooks/useAppChat.ts](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppChat.ts#L490-L508)

Subscribe from your component to receive the accumulated thinking text as it
streams:

```ts
useEffect(() => {
  const unsubscribe = subscribeToThinking((thinkingText) => {
    // Update a ref or DOM element directly for smooth rendering
    thinkingRef.current = thinkingText;
  });
  return unsubscribe;
}, [subscribeToThinking]);
```

The same pattern applies to `subscribeToStreaming` for the main response text.
Both bypass React state updates to avoid re-render overhead during rapid
streaming.
