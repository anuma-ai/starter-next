# Memory Engine

The `useAppChat` hook adds memory-augmented responses on top of
`useAppChatStorage`. Memory lets the AI recall information from past
conversations — things like the user's name, preferences, or previously
discussed topics — so it can give contextual answers without the user repeating
themselves.

## How It Works

Memory operates in two phases: storage and retrieval.

**Storage.** The SDK automatically embeds every message when it's stored. Long
messages are split into chunks, and each chunk gets a vector embedding (a
numerical representation of its meaning). These vectors live in WatermelonDB
alongside the message content.

**Retrieval.** When a new message is sent, a memory engine tool is injected
as a client tool. The AI reads the system prompt, which tells it about the tool,
and decides whether the user's question might benefit from past context. If so,
it calls the tool. The tool converts the query into a vector, runs a similarity
search against all stored embeddings (excluding the current conversation), and
returns the closest matching chunks.

The AI then uses those chunks as context to formulate its response. If the
question doesn't need memory (e.g., "what's 2+2"), the AI simply doesn't call
the tool.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

## Memory Settings

Three settings control memory behavior. They're persisted in `localStorage` and
synced across tabs via `StorageEvent`, so changes from the settings page take
effect immediately without a reload.

{@includeCode ../../hooks/useAppChat.ts#memorySettings}

- `memoryEnabled` — toggle memory on or off. Default: `true`.
- `memoryLimit` — max chunks returned per search (1–20). Default: `5`. Higher
  values provide more context but use more tokens.
- `memoryThreshold` — minimum similarity score (0.0–0.8). Default: `0.2` (20%).
  Lower values return more matches; higher values are stricter.

Settings are loaded from `localStorage` on mount and updated in real time when
changed from another tab or the settings page:

{@includeCode ../../hooks/useAppChat.ts#memorySettingsLoader}

## Creating the Memory Tool

On each `sendMessage` call, a memory engine tool is created with the current
settings and added to the client tools array. The current conversation is
excluded so the AI only recalls information from other conversations.

If the conversation is brand new (no ID yet), one is created first so the
exclusion works correctly.

When memory is disabled, the tool is simply omitted.

{@includeCode ../../hooks/useAppChat.ts#memoryToolCreation}

## System Prompt

The default system prompt tells the AI when to use the memory tool:

```
You have access to a memory engine tool that can recall information from
previous conversations with this user. When the user asks questions that might
relate to past conversations (like their name, preferences, personal
information, or previously discussed topics), use the memory engine tool to
recall relevant context before responding.
```

This can be overridden by passing a custom `systemPrompt` to the hook.
