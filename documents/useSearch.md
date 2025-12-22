# Searching the Web

The `useSearch` hook from `@reverbia/sdk/react` provides web search
capabilities. It searches the web using various search providers and returns
structured results with titles, URLs, and snippets.

## Prerequisites

- An authentication function that returns a valid token
- Optional: A custom base URL for the API

## Hook Initialization

{@includeCode ../hooks/useAppSearch.ts#hookInit}

## Performing a Search

{@includeCode ../hooks/useAppSearch.ts#performSearch}
