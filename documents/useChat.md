---
title: useChat
---

The `useAppChat` hook combines `useAppChatStorage` and `useAppMemoryStorage` to
provide a complete chat experience with persistent storage and memory-augmented
responses.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

## Hook Initialization

{@includeCode ../hooks/useAppChat.ts#hookInit}

## Sending Messages

{@includeCode ../hooks/useAppChat.ts#sendMessage}
