---
title: useChatStorage
---

The `useChatStorage` hook from `@reverbia/sdk/react` provides persistent chat
storage with WatermelonDB. It manages conversations, message history, and
handles syncing between local storage and the server.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- An authentication function that returns a valid token

## Hook Initialization

{@includeCode ../hooks/useAppChatStorage.ts#hookInit}

## Sending Messages

{@includeCode ../hooks/useAppChatStorage.ts#sendMessage}

## Conversation Management

{@includeCode ../hooks/useAppChatStorage.ts#conversationManagement}
