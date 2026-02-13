"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronDown, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HugeiconsIcon } from "@hugeicons/react";
import { CancelCircleIcon } from "@hugeicons/core-free-icons";
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
  const { getVaultMemories, createVaultMemory, updateVaultMemory, deleteVaultMemory } = useChatContext();
  const [vaultEnabled, setVaultEnabled] = useState(DEFAULT_VAULT_ENABLED);
  const [memories, setMemories] = useState<VaultMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMemory, setNewMemory] = useState("");

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

  const handleAdd = async () => {
    const content = newMemory.trim();
    if (!content) return;
    const created = await createVaultMemory(content);
    setMemories((prev) => [created, ...prev]);
    setNewMemory("");
  };

  const editingRef = useRef<Record<string, string>>({});

  const handleBlur = async (id: string, newContent: string) => {
    const trimmed = newContent.trim();
    const original = memories.find((m) => m.uniqueId === id)?.content;
    delete editingRef.current[id];
    if (!trimmed || trimmed === original) return;
    const updated = await updateVaultMemory(id, trimmed);
    if (updated) {
      setMemories((prev) =>
        prev.map((m) => (m.uniqueId === id ? updated : m))
      );
    }
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

          <Collapsible className="rounded-xl bg-white dark:bg-card p-1">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium cursor-pointer [&[data-state=open]>svg]:rotate-180">
              How the vault works
              <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 text-sm text-muted-foreground space-y-2">
                <p>
                  The memory vault stores facts and preferences that the AI explicitly
                  decides to remember during your conversations. Unlike memory retrieval
                  (which searches past messages), the vault keeps curated, persistent notes.
                </p>
                <p>
                  When the AI wants to save something, it first searches existing vault
                  memories using semantic similarity to avoid duplicates. If a related
                  memory already exists, it updates the entry instead of creating a new one.
                  Each save requires your confirmation before it&apos;s stored.
                </p>
                <p>
                  Vault memories are embedded at save time so searches are instant.
                  When a wallet is connected, memories are encrypted at rest.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="relative rounded-xl bg-white dark:bg-card">
            <Input
              type="text"
              placeholder="Add a memory..."
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="border-0 focus-visible:ring-0 rounded-xl bg-transparent shadow-none px-5 pr-28 h-[52px]"
            />
            {newMemory.trim() && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  onClick={() => setNewMemory("")}
                  className="text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
                >
                  <HugeiconsIcon icon={CancelCircleIcon} size={18} />
                </button>
                <button
                  onClick={handleAdd}
                  className="text-sm bg-foreground text-background px-3 py-1 rounded-xl hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ cornerShape: "squircle" } as React.CSSProperties}
                >
                  Save
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white dark:bg-card p-1">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : memories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No memories saved yet. The AI will save important facts as you chat.
              </p>
            ) : (
              memories.map((memory) => {
                const date = memory.updatedAt
                  ? new Date(memory.updatedAt)
                  : new Date(memory.createdAt);
                const formattedDate = date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div
                    key={memory.uniqueId}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 rounded-lg text-left group"
                  >
                    <span
                      className="text-sm outline-none flex-1"
                      contentEditable
                      suppressContentEditableWarning
                      onFocus={() => {
                        editingRef.current[memory.uniqueId] = memory.content;
                      }}
                      onBlur={(e) => {
                        handleBlur(memory.uniqueId, e.currentTarget.textContent || "");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                        if (e.key === "Escape") {
                          e.currentTarget.textContent = editingRef.current[memory.uniqueId] || memory.content;
                          delete editingRef.current[memory.uniqueId];
                          e.currentTarget.blur();
                        }
                      }}
                    >
                      {memory.content}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        {formattedDate}
                      </span>
                      <button
                        onClick={() => handleDelete(memory.uniqueId)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
