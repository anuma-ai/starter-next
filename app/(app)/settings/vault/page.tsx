"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useChatContext } from "@/app/components/chat-provider";

const DEFAULT_VAULT_ENABLED = true;

function setLocalStorageWithEvent(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(
    new StorageEvent("storage", { key, newValue: value })
  );
}

type VaultMemory = {
  uniqueId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
};

export default function VaultPage() {
  const router = useRouter();
  const { getVaultMemories, deleteVaultMemory } = useChatContext();
  const [vaultEnabled, setVaultEnabled] = useState(DEFAULT_VAULT_ENABLED);
  const [memories, setMemories] = useState<VaultMemory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("chat_vaultEnabled");
    if (saved !== null) setVaultEnabled(saved === "true");
  }, []);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const mems = await getVaultMemories();
      setMemories(mems);
    } catch {
      // Failed to load
    } finally {
      setLoading(false);
    }
  }, [getVaultMemories]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleVaultEnabledChange = (checked: boolean) => {
    setVaultEnabled(checked);
    setLocalStorageWithEvent("chat_vaultEnabled", checked.toString());
  };

  const handleDelete = async (id: string) => {
    await deleteVaultMemory(id);
    setMemories((prev) => prev.filter((m) => m.uniqueId !== id));
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
          <h1 className="text-lg font-semibold w-full text-center">Memory Vault</h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-card p-1">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="vaultEnabled" className="text-base">
                    Enable memory vault
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow the AI to save important facts and preferences during conversations
                  </p>
                </div>
                <Switch
                  id="vaultEnabled"
                  checked={vaultEnabled}
                  onCheckedChange={handleVaultEnabledChange}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-card p-1">
            <div className="px-4 py-3">
              <h3 className="text-sm font-medium mb-3">
                Stored memories
                {!loading && memories.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-1">({memories.length})</span>
                )}
              </h3>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : memories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No memories saved yet. The AI will save important facts as you chat.
                </p>
              ) : (
                <div className="space-y-2">
                  {memories.map((memory) => (
                    <div
                      key={memory.uniqueId}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <p className="flex-1 text-sm">{memory.content}</p>
                      <button
                        onClick={() => handleDelete(memory.uniqueId)}
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-card p-4">
            <h3 className="text-sm font-medium mb-2">How the vault works</h3>
            <p className="text-sm text-muted-foreground">
              The memory vault stores facts and preferences that the AI explicitly decides to
              remember during your conversations. Unlike memory retrieval (which searches past
              messages), the vault keeps curated, persistent notes. Each save requires your
              confirmation before it&apos;s stored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
