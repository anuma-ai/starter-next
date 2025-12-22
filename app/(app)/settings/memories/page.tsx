"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Trash2 } from "lucide-react";
import { useMemoryStorage, type StoredMemory } from "@reverbia/sdk/react";
import { useDatabase } from "@/app/providers";

export default function MemoriesPage() {
  const router = useRouter();
  const database = useDatabase();
  const [memories, setMemories] = useState<StoredMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { fetchAllMemories, removeMemoryById } = useMemoryStorage({
    database,
  });

  useEffect(() => {
    const loadMemories = async () => {
      try {
        const allMemories = await fetchAllMemories();
        setMemories(allMemories);
      } catch (error) {
        console.error("Failed to load memories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMemories();
  }, [fetchAllMemories]);

  const handleDeleteMemory = async (id: string) => {
    try {
      await removeMemoryById(id);
      setMemories((prev) => prev.filter((m) => m.uniqueId !== id));
    } catch (error) {
      console.error("Failed to delete memory:", error);
    }
  };

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center h-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings")}
            className="absolute"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold w-full text-center">Memories</h1>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-xl bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Loading memories...
              </p>
            </div>
          ) : memories.length === 0 ? (
            <div className="rounded-xl bg-card p-4">
              <p className="text-sm text-muted-foreground">
                No memories yet. The assistant will save important information
                from your conversations here.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-card p-1">
              {memories.map((memory, index) => (
                <div
                  key={memory.uniqueId}
                  className={`group flex items-start justify-between px-4 py-3 ${
                    index < memories.length - 1 ? "border-b border-border/50" : ""
                  }`}
                >
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{memory.value}</p>
                    <p className="text-xs text-muted-foreground">
                      {memory.namespace} · {memory.key}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteMemory(memory.uniqueId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
