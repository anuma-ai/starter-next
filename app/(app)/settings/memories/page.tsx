"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

const DEFAULT_MEMORY_LIMIT = 5;
const DEFAULT_MEMORY_THRESHOLD = 0.2;
const DEFAULT_MEMORY_ENABLED = true;

// Helper to update localStorage and dispatch event for same-tab listeners
function setLocalStorageWithEvent(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(
    new StorageEvent("storage", { key, newValue: value })
  );
}

export default function MemoriesPage() {
  const router = useRouter();
  const [memoryEnabled, setMemoryEnabled] = useState(DEFAULT_MEMORY_ENABLED);
  const [memoryLimit, setMemoryLimit] = useState(DEFAULT_MEMORY_LIMIT);
  const [memoryThreshold, setMemoryThreshold] = useState(DEFAULT_MEMORY_THRESHOLD);

  useEffect(() => {
    const savedEnabled = localStorage.getItem("chat_memoryEnabled");
    if (savedEnabled !== null) setMemoryEnabled(savedEnabled === "true");

    const savedMemoryLimit = localStorage.getItem("chat_memoryLimit");
    if (savedMemoryLimit) {
      const limit = parseInt(savedMemoryLimit, 10);
      if (!isNaN(limit) && limit > 0) {
        setMemoryLimit(limit);
      }
    }

    const savedMemoryThreshold = localStorage.getItem("chat_memoryThreshold");
    if (savedMemoryThreshold) {
      const threshold = parseFloat(savedMemoryThreshold);
      if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
        setMemoryThreshold(threshold);
      }
    }
  }, []);

  const handleMemoryEnabledChange = (checked: boolean) => {
    setMemoryEnabled(checked);
    setLocalStorageWithEvent("chat_memoryEnabled", checked.toString());
  };

  const handleMemoryLimitChange = (value: number[]) => {
    const limit = value[0];
    setMemoryLimit(limit);
    setLocalStorageWithEvent("chat_memoryLimit", limit.toString());
  };

  const handleMemoryThresholdChange = (value: number[]) => {
    const threshold = value[0];
    setMemoryThreshold(threshold);
    setLocalStorageWithEvent("chat_memoryThreshold", threshold.toString());
  };

  return (
    <div className="flex flex-1 flex-col p-8 pt-16 md:pt-8 bg-sidebar dark:bg-background border-l border-border dark:border-l-0">
      <div className="mx-auto w-full max-w-2xl pb-8">
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

        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-card p-1">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="memoryEnabled" className="text-base">
                    Enable memory retrieval
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow the AI to search past conversations for relevant context
                  </p>
                </div>
                <Switch
                  id="memoryEnabled"
                  checked={memoryEnabled}
                  onCheckedChange={handleMemoryEnabledChange}
                />
              </div>
            </div>

            <div className={`px-4 py-3 border-t border-border ${!memoryEnabled ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="memoryLimit" className="text-base">
                      Retrieval limit
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {memoryLimit} chunks
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Maximum number of memory chunks to retrieve. Higher values provide more
                    context but use more tokens.
                  </p>
                  <Slider
                    id="memoryLimit"
                    min={1}
                    max={20}
                    step={1}
                    value={[memoryLimit]}
                    onValueChange={handleMemoryLimitChange}
                    className="w-full"
                    disabled={!memoryEnabled}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Less context</span>
                    <span>More context</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`px-4 py-3 border-t border-border ${!memoryEnabled ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="memoryThreshold" className="text-base">
                      Similarity threshold
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {(memoryThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Minimum similarity score for memories to be included. Lower values
                    include more matches, higher values are stricter.
                  </p>
                  <Slider
                    id="memoryThreshold"
                    min={0}
                    max={0.8}
                    step={0.05}
                    value={[memoryThreshold]}
                    onValueChange={handleMemoryThresholdChange}
                    className="w-full"
                    disabled={!memoryEnabled}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>More matches</span>
                    <span>Stricter</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-card p-4">
            <h3 className="text-sm font-medium mb-2">How memories work</h3>
            <p className="text-sm text-muted-foreground">
              When you ask a question, the AI can search your past conversations to find
              relevant context. This helps it remember things you&apos;ve discussed before,
              like your preferences or previous topics. The AI decides when to search based
              on your question.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
