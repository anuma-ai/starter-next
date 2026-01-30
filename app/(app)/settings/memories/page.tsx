"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { useIdentityToken } from "@privy-io/react-auth";
import {
  useChatStorage,
  generateEmbedding,
  type StoredMessageWithSimilarity,
} from "@reverbia/sdk/react";
import { useDatabase } from "@/app/providers";

export default function MemoriesPage() {
  const router = useRouter();
  const database = useDatabase();
  const { identityToken } = useIdentityToken();

  const [results, setResults] = useState<StoredMessageWithSimilarity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");

  const getToken = useCallback(
    () => Promise.resolve(identityToken ?? null),
    [identityToken]
  );

  const { searchMessages } = useChatStorage({
    database,
    getToken,
  });

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setError(null);
    setLastQuery(query);

    try {
      const embedding = await generateEmbedding(query, {
        getToken,
        baseUrl: process.env.NEXT_PUBLIC_API_URL,
      });

      const searchResults = await searchMessages(embedding, {
        limit: 20,
        minSimilarity: 0,
      });

      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      console.error("Memory search error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, getToken, searchMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isSearching) {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-1 flex-col p-8 bg-sidebar dark:bg-background border-l border-border dark:border-l-0">
      <div className="mx-auto w-full max-w-2xl">
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

        {/* Search Input */}
        <div className="relative mb-6">
          <HugeiconsIcon
            icon={Search01Icon}
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Search past messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSearching}
            className="pl-12 py-6 border-0 focus-visible:ring-0 rounded-xl bg-white dark:bg-card shadow-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Results */}
        {lastQuery && !isSearching && (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Found {results.length} result{results.length !== 1 ? "s" : ""} for
              "{lastQuery}"
            </p>

            {results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No messages found matching your query.
              </div>
            ) : (
              <div className="rounded-xl bg-white dark:bg-card p-1">
                {results.map((message) => (
                  <MessageResultCard key={message.uniqueId} message={message} />
                ))}
              </div>
            )}
          </>
        )}

        {isSearching && (
          <div className="text-center py-8 text-muted-foreground">
            Searching...
          </div>
        )}

        {!lastQuery && !isSearching && (
          <div className="rounded-xl bg-white dark:bg-card p-8 text-center text-muted-foreground">
            Type a query and press Enter to search past messages
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
    <div className="px-4 py-3 hover:bg-sidebar dark:hover:bg-muted/50 rounded-lg transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            message.role === "user"
              ? "bg-neutral-600 text-white dark:bg-neutral-500 dark:text-white"
              : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
          }`}
        >
          {message.role}
        </span>
        <span className="text-xs text-muted-foreground">
          {similarityPercent}% match
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(message.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
      <p className="text-sm line-clamp-2">{message.content}</p>
    </div>
  );
}
