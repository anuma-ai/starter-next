# Searching the Web

The `useSearch` hook from `@reverbia/sdk/react` provides web search
capabilities. It searches the web using various search providers and returns
structured results with titles, URLs, and snippets.

## Prerequisites

- An authentication function that returns a valid token
- Optional: A custom base URL for the API

## Hook Initialization

```ts
const { search, isLoading, error } = useSearch({
  getToken,
  baseUrl: baseUrl || process.env.NEXT_PUBLIC_API_URL,
});
```

## Performing a Search

```ts
const performSearch = useCallback(
  async (
    query: string,
    options?: {
      searchTool?: string;
    }
  ) => {
    const searchTool = options?.searchTool || "google-pse";

    const result = await search(query, {
      search_tool_name: searchTool,
    });

    if (result?.results) {
      const results: SearchResult[] = result.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
      }));

      setSearchHistory((prev) => [
        {
          query,
          results,
          timestamp: Date.now(),
        },
        ...prev,
      ]);

      return results;
    }

    return [];
  },
  [search]
);
```
