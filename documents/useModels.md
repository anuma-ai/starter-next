# Fetching Models

The `useModels` hook from `@reverbia/sdk/react` fetches and manages the list of
available LLM models from the API. It provides model metadata and supports
refreshing the list.

## Prerequisites

- An authentication function that returns a valid token
- Optional: A custom base URL for the API

## Hook Initialization

{@includeCode ../hooks/useAppModels.ts#hookInit}
