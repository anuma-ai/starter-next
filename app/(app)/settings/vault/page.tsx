"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronDown, Trash2, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HugeiconsIcon } from "@hugeicons/react";
import { CancelCircleIcon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useChatContext } from "@/app/components/chat-provider";

const DEFAULT_VAULT_ENABLED = true;
const DEFAULT_VAULT_SEARCH_LIMIT = 5;
const DEFAULT_VAULT_SEARCH_THRESHOLD = 0.1;

const DEFAULT_VAULT_PROMPT = `You also have access to a memory vault for storing important facts and preferences the user shares. The vault has two tools:
- memory_vault_search: Search existing vault memories by semantic similarity. Returns matching entries with their IDs.
- memory_vault_save: Save or update a vault memory. Pass an "id" to update an existing entry.

IMPORTANT — vault workflow:
- When the user tells you something worth remembering, ALWAYS call memory_vault_search first to check if a related memory already exists.
- If memory_vault_search returns a related entry, use its id with memory_vault_save to UPDATE it rather than creating a duplicate. Merge the new information into the existing text.
- Only omit the "id" parameter when memory_vault_search confirms no existing entry is related.
- The vault should stay compact: one entry per topic, updated over time.
- When answering questions that might involve stored preferences or facts, call memory_vault_search to check.`;

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
  const [searchLimit, setSearchLimit] = useState(DEFAULT_VAULT_SEARCH_LIMIT);
  const [searchThreshold, setSearchThreshold] = useState(DEFAULT_VAULT_SEARCH_THRESHOLD);
  const [memories, setMemories] = useState<VaultMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMemory, setNewMemory] = useState("");
  const [vaultPrompt, setVaultPrompt] = useState(DEFAULT_VAULT_PROMPT);
  const [isCustomPrompt, setIsCustomPrompt] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("chat_vaultEnabled");
    if (saved !== null) setVaultEnabled(saved === "true");

    const savedLimit = localStorage.getItem("chat_vaultSearchLimit");
    if (savedLimit) {
      const limit = parseInt(savedLimit, 10);
      if (!isNaN(limit) && limit > 0) setSearchLimit(limit);
    }

    const savedThreshold = localStorage.getItem("chat_vaultSearchThreshold");
    if (savedThreshold) {
      const threshold = parseFloat(savedThreshold);
      if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) setSearchThreshold(threshold);
    }

    const savedVaultPrompt = localStorage.getItem("chat_vaultPrompt");
    if (savedVaultPrompt !== null) {
      setVaultPrompt(savedVaultPrompt);
      setIsCustomPrompt(true);
    }
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

  const handleSearchLimitChange = (value: number[]) => {
    setSearchLimit(value[0]);
    setLocalStorageWithEvent("chat_vaultSearchLimit", value[0].toString());
  };

  const handleSearchThresholdChange = (value: number[]) => {
    setSearchThreshold(value[0]);
    setLocalStorageWithEvent("chat_vaultSearchThreshold", value[0].toString());
  };

  const handleVaultPromptChange = (value: string) => {
    setVaultPrompt(value);
    setIsCustomPrompt(true);
    setLocalStorageWithEvent("chat_vaultPrompt", value);
  };

  const handleVaultPromptReset = () => {
    setVaultPrompt(DEFAULT_VAULT_PROMPT);
    setIsCustomPrompt(false);
    localStorage.removeItem("chat_vaultPrompt");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "chat_vaultPrompt", newValue: null })
    );
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
                  <span className="flex items-center gap-1.5">
                    <Label htmlFor="vaultEnabled" className="text-base">
                      Enable memory vault
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="max-w-sm p-3">
                        <div className="text-sm space-y-2">
                          <p>
                            The memory vault stores facts and preferences that the AI explicitly
                            decides to remember during your conversations. Unlike memory retrieval
                            (which searches past messages), the vault keeps curated, persistent notes.
                          </p>
                          <p>
                            When the AI wants to save something, it first searches existing vault
                            memories using semantic similarity to avoid duplicates. If a related
                            memory already exists, it updates the entry instead of creating a new one.
                          </p>
                          <p>
                            Vault memories are embedded at save time so searches are instant.
                            When a wallet is connected, memories are encrypted at rest.
                          </p>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
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

            <Collapsible className={`border-t border-border ${!vaultEnabled ? "opacity-50 pointer-events-none" : ""}`}>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium cursor-pointer [&[data-state=open]>svg]:rotate-180">
                Advanced
                <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 py-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="searchLimit" className="text-base">
                      Search limit
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {searchLimit} results
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Maximum number of vault memories returned when the AI searches.
                  </p>
                  <Slider
                    id="searchLimit"
                    min={1}
                    max={20}
                    step={1}
                    value={[searchLimit]}
                    onValueChange={handleSearchLimitChange}
                    className="w-full"
                    disabled={!vaultEnabled}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Fewer results</span>
                    <span>More results</span>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="searchThreshold" className="text-base">
                      Similarity threshold
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {(searchThreshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Minimum similarity score for vault memories to be included in search results.
                  </p>
                  <Slider
                    id="searchThreshold"
                    min={0}
                    max={0.8}
                    step={0.05}
                    value={[searchThreshold]}
                    onValueChange={handleSearchThresholdChange}
                    className="w-full"
                    disabled={!vaultEnabled}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>More matches</span>
                    <span>Stricter</span>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="vaultPrompt" className="text-base">
                      Vault instructions
                    </Label>
                    {isCustomPrompt && (
                      <button
                        onClick={handleVaultPromptReset}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Controls how the AI saves and retrieves vault memories. Appended to the system prompt when the vault is enabled.
                  </p>
                  <textarea
                    id="vaultPrompt"
                    value={vaultPrompt}
                    onChange={(e) => handleVaultPromptChange(e.target.value)}
                    disabled={!vaultEnabled}
                    className="w-full min-h-[200px] rounded-lg border border-border bg-sidebar dark:bg-background p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="rounded-xl bg-white dark:bg-card p-1">
            <div className="relative border-b border-border">
              <Input
                type="text"
                placeholder="Add a memory..."
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                className="border-0 focus-visible:ring-0 rounded-lg bg-transparent dark:bg-transparent shadow-none px-5 pr-28 h-[52px]"
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
                    className="flex w-full items-start justify-between gap-2 px-4 py-3 rounded-lg text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-sm outline-none"
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
                      <span className="text-xs text-muted-foreground ml-2">
                        {formattedDate}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition-colors p-1 opacity-0 group-hover:opacity-100 cursor-pointer shrink-0">
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDelete(memory.uniqueId)}
                          className="text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="size-4 mr-2 text-destructive" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
