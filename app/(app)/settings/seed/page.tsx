"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { useIdentityToken } from "@privy-io/react-auth";
import {
  getDatabaseStats,
  clearAndSeedLongMemEval,
  clearAllEmbeddings,
  regenerateAllEmbeddings,
} from "@/lib/seed-database";
import { fetchLongMemEvalDataset, getDatasetStats } from "@/lib/longmemeval";

type Status = "idle" | "loading" | "success" | "error";

export default function SeedPage() {
  const router = useRouter();
  const { identityToken } = useIdentityToken();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<{
    phase: string;
    current: number;
    total: number;
  } | null>(null);
  const [stats, setStats] = useState<{
    projects: number;
    conversations: number;
    messages: number;
  } | null>(null);
  const [datasetStats, setDatasetStats] = useState<{
    totalEntries: number;
    totalSessions: number;
    totalMessages: number;
  } | null>(null);
  const [maxMessages, setMaxMessages] = useState(100);
  const [generateEmbeddings, setGenerateEmbeddings] = useState(true);

  const getToken = useCallback(
    () => Promise.resolve(identityToken ?? null),
    [identityToken]
  );

  useEffect(() => {
    refreshStats();
    loadDatasetStats();
  }, []);

  const refreshStats = async () => {
    try {
      const currentStats = await getDatabaseStats();
      setStats(currentStats);
    } catch (err) {
      console.error("Failed to get stats:", err);
    }
  };

  const loadDatasetStats = async () => {
    try {
      const dataset = await fetchLongMemEvalDataset();
      const stats = getDatasetStats(dataset);
      setDatasetStats(stats);
    } catch (err) {
      console.error("Failed to load dataset stats:", err);
    }
  };

  const handleSeedLongMemEval = async () => {
    setStatus("loading");
    setMessage("Seeding LongMemEval data...");
    setProgress(null);

    try {
      const result = await clearAndSeedLongMemEval({
        maxMessages,
        generateEmbeddings,
        getToken,
        onProgress: setProgress,
      });

      if (result.success) {
        setStatus("success");
        setMessage(
          `Seeding complete! Created ${result.conversationsCreated} conversations, ` +
            `${result.messagesCreated} messages` +
            (generateEmbeddings
              ? `, ${result.embeddingsGenerated} embeddings`
              : "")
        );
      } else {
        setStatus("error");
        setMessage(`Failed: ${result.error || "Unknown error"}`);
      }

      await refreshStats();
    } catch (err) {
      setStatus("error");
      setMessage(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setProgress(null);
    }
  };

  const handleRegenerateEmbeddings = async () => {
    setStatus("loading");
    setMessage("Regenerating embeddings...");
    setProgress(null);

    try {
      const result = await regenerateAllEmbeddings({
        getToken,
        onProgress: setProgress,
      });

      if (result.success) {
        setStatus("success");
        setMessage(`Regenerated ${result.embeddingsGenerated} embeddings`);
      } else {
        setStatus("error");
        setMessage(`Failed: ${result.error || "Unknown error"}`);
      }

      await refreshStats();
    } catch (err) {
      setStatus("error");
      setMessage(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setProgress(null);
    }
  };

  const handleClearEmbeddings = async () => {
    setStatus("loading");
    setMessage("Clearing all embeddings...");

    try {
      const result = await clearAllEmbeddings();

      if (result.success) {
        setStatus("success");
        setMessage(`Cleared embeddings from ${result.messagesCleared} messages`);
      } else {
        setStatus("error");
        setMessage(`Failed: ${result.error || "Unknown error"}`);
      }

      await refreshStats();
    } catch (err) {
      setStatus("error");
      setMessage(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
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
          <h1 className="text-lg font-semibold w-full text-center">
            Seed Database
          </h1>
        </div>

        {/* Current Database Stats */}
        {stats && (
          <div className="rounded-xl bg-white dark:bg-card p-4 mb-4">
            <h3 className="font-medium mb-2">Current Database</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Conversations: {stats.conversations}</p>
              <p>Messages: {stats.messages}</p>
            </div>
          </div>
        )}

        {/* Dataset Stats */}
        {datasetStats && (
          <div className="rounded-xl bg-white dark:bg-card p-4 mb-4">
            <h3 className="font-medium mb-2">LongMemEval Dataset</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Total entries: {datasetStats.totalEntries}</p>
              <p>
                Total sessions: {datasetStats.totalSessions.toLocaleString()}
              </p>
              <p>
                Total messages: {datasetStats.totalMessages.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Configuration */}
        <div className="rounded-xl bg-white dark:bg-card p-4 mb-4 space-y-5">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Messages to insert: {maxMessages}
            </Label>
            <Slider
              min={10}
              max={1000}
              step={10}
              value={[maxMessages]}
              onValueChange={([value]) => setMaxMessages(value)}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10</span>
              <span>1000</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="embeddings" className="text-sm">
              Generate embeddings for messages
            </Label>
            <Switch
              id="embeddings"
              checked={generateEmbeddings}
              onCheckedChange={setGenerateEmbeddings}
            />
          </div>
        </div>

        {/* Seed Button */}
        <Button
          onClick={handleSeedLongMemEval}
          disabled={status === "loading" || !identityToken}
          className="w-full py-6 rounded-xl mb-4"
        >
          {status === "loading" ? "Seeding..." : "Reset & Seed LongMemEval"}
        </Button>

        {/* Regenerate Embeddings Button */}
        <Button
          onClick={handleRegenerateEmbeddings}
          disabled={status === "loading" || !identityToken}
          variant="outline"
          className="w-full py-6 rounded-xl mb-4"
        >
          {status === "loading" ? "Processing..." : "Regenerate All Embeddings"}
        </Button>

        {/* Clear Embeddings Button */}
        <Button
          onClick={handleClearEmbeddings}
          disabled={status === "loading"}
          variant="outline"
          className="w-full py-6 rounded-xl mb-4"
        >
          {status === "loading" ? "Processing..." : "Clear All Embeddings"}
        </Button>

        {!identityToken && (
          <p className="text-sm text-amber-600 mb-4">
            Please sign in to generate embeddings
          </p>
        )}

        {/* Progress */}
        {progress && (
          <div className="rounded-xl bg-muted p-4 mb-4">
            <p className="text-sm font-medium">{progress.phase}</p>
            <div className="w-full bg-background rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {progress.current} / {progress.total}
            </p>
          </div>
        )}

        {/* Status Message */}
        {message && status !== "loading" && (
          <div
            className={`rounded-xl p-4 text-sm ${
              status === "success"
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : status === "error"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-muted"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
