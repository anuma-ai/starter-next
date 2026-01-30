"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useIdentityToken } from "@privy-io/react-auth";
import {
  useChatStorage,
  generateEmbedding,
  type StoredMessageWithSimilarity,
} from "@reverbia/sdk/react";
import { useDatabase } from "@/app/providers";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/chat/prompt-input";

export default function MemoriesPage() {
  const router = useRouter();
  const database = useDatabase();
  const { identityToken } = useIdentityToken();

  const [limit, setLimit] = useState(10);
  const [minSimilarity, setMinSimilarity] = useState(0.3);
  const [results, setResults] = useState<StoredMessageWithSimilarity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");

  const getToken = useCallback(
    () => Promise.resolve(identityToken ?? null),
    [identityToken]
  );

  const { searchMessages } = useChatStorage({
    database,
    getToken,
  });

  const handleSearch = useCallback(
    async (message: PromptInputMessage) => {
      const query = message.text.trim();
      if (!query) return;

      setIsSearching(true);
      setError(null);
      setLastQuery(query);

      try {
        // Generate embedding for the query
        const embedding = await generateEmbedding(query, {
          getToken,
          baseUrl: process.env.NEXT_PUBLIC_API_URL,
        });

        // Search messages by similarity
        const searchResults = await searchMessages(embedding, {
          limit,
          minSimilarity,
        });

        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        console.error("Memory search error:", err);
      } finally {
        setIsSearching(false);
      }
    },
    [getToken, searchMessages, limit, minSimilarity]
  );

  return (
    <div className="flex flex-1 flex-col p-8 pt-16 md:pt-8 bg-sidebar dark:bg-background border-l border-border dark:border-l-0">
      <div className="mx-auto w-full max-w-2xl pb-8">
        {/* Header */}
        <div className="mb-6 flex items-center h-8 relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings")}
            className="absolute left-0 top-1/2 -translate-y-1/2"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold w-full text-center">Memories</h1>
        </div>

        {/* Configuration */}
        <div className="rounded-xl bg-white dark:bg-card p-4 mb-4 space-y-4 border border-border dark:border-transparent">
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">Max Results</Label>
              <span className="text-sm text-muted-foreground">{limit}</span>
            </div>
            <Slider
              value={[limit]}
              onValueChange={([v]) => setLimit(v)}
              min={1}
              max={50}
              step={1}
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">Min Similarity</Label>
              <span className="text-sm text-muted-foreground">
                {Math.round(minSimilarity * 100)}%
              </span>
            </div>
            <Slider
              value={[minSimilarity]}
              onValueChange={([v]) => setMinSimilarity(v)}
              min={0}
              max={1}
              step={0.05}
            />
          </div>
        </div>

        {/* Search Input */}
        <div className="rounded-xl bg-white dark:bg-card overflow-hidden mb-4 border border-border dark:border-transparent">
          <PromptInput onSubmit={handleSearch}>
            <div className="flex w-full items-center gap-1 px-3 py-2">
              <PromptInputTextarea
                placeholder="Search past messages..."
                className="flex-1 px-2"
              />
              <PromptInputSubmit disabled={isSearching}>
                {isSearching && <Loader2 className="size-4 animate-spin" />}
              </PromptInputSubmit>
            </div>
          </PromptInput>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {lastQuery && !isSearching && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Found {results.length} result{results.length !== 1 ? "s" : ""} for
              "{lastQuery}"
            </p>

            {results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No messages found matching your query.
                <br />
                <span className="text-sm">
                  Try lowering the similarity threshold or using different
                  terms.
                </span>
              </div>
            ) : (
              results.map((message) => (
                <MessageResultCard key={message.uniqueId} message={message} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageResultCard({
  message,
}: {
  message: StoredMessageWithSimilarity;
}) {
  const similarityPercent = Math.round(message.similarity * 100);

  return (
    <div className="rounded-lg border border-border bg-white dark:bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Role badge and similarity */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 rounded text-xs text-white font-medium ${
                message.role === "user" ? "bg-blue-500" : "bg-green-500"
              }`}
            >
              {message.role}
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
              {similarityPercent}% match
            </span>
          </div>

          {/* Content */}
          <p className="text-sm line-clamp-4 whitespace-pre-wrap">
            {message.content}
          </p>

          {/* Metadata */}
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(message.createdAt).toLocaleString()}
            {message.conversationId && (
              <span className="ml-2">Conv: {message.conversationId.slice(0, 8)}...</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
