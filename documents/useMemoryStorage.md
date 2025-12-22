# Storing Memories

The `useMemoryStorage` hook from `@reverbia/sdk/react` provides memory
extraction and semantic search capabilities. It automatically extracts facts
from conversations and stores them with embeddings for later retrieval.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- Optional: An authentication function for API-based embeddings

## Hook Initialization

{@includeCode ../hooks/useAppMemoryStorage.ts#hookInit}

## Extracting Memories

{@includeCode ../hooks/useAppMemoryStorage.ts#extractMemories}

## Searching Memories

{@includeCode ../hooks/useAppMemoryStorage.ts#searchMemories}
