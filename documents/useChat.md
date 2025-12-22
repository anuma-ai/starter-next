---
title: useChat
---

The `useChat` hook combines `useChatStorage` and `useMemoryStorage` from
`@reverbia/sdk/react` to provide a complete chat experience with persistent
storage and memory-augmented responses. It handles message sending, conversation
management, and automatic memory extraction from user messages.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

## Chat Storage Initialization

The hook uses `useChatStorage` internally for message persistence:

{@includeCode ../hooks/useAppChat.ts#chatStorageInit}

## Memory Storage Initialization

Memory storage enables semantic search over past conversations:

{@includeCode ../hooks/useAppChat.ts#memoryStorageInit}
