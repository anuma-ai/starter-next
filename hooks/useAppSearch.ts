"use client";

import { useCallback, useState } from "react";
import { useSearch } from "@reverbia/sdk/react";

/**
 * useSearch Hook Example
 *
 * The useSearch hook provides web search capabilities.
 * It can search the web using various search providers and
 * return structured results with titles, URLs, and snippets.
 */

type UseSearchProps = {
  getToken: () => Promise<string | null>;
  baseUrl?: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type SearchHistory = {
  query: string;
  results: SearchResult[];
  timestamp: number;
};

export function useAppSearch({ getToken, baseUrl }: UseSearchProps) {
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);

  //#region hookInit
  const { search, isLoading, error } = useSearch({
    getToken,
    baseUrl: baseUrl || process.env.NEXT_PUBLIC_API_URL,
  });
  //#endregion hookInit

  //#region performSearch
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
  //#endregion performSearch

  const formatResultsAsMarkdown = useCallback((results: SearchResult[]) => {
    return results
      .map((r) => `#### [${r.title}](${r.url})\n${r.snippet}`)
      .join("\n\n");
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
  }, []);

  return {
    performSearch,
    formatResultsAsMarkdown,
    searchHistory,
    isLoading,
    error,
    clearHistory,
  };
}
