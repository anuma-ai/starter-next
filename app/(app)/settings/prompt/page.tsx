"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Label } from "@/components/ui/label";

const DEFAULT_SYSTEM_PROMPT = `You have access to a memory engine tool that can recall information from previous conversations with this user. When the user asks questions that might relate to past conversations (like their name, preferences, personal information, or previously discussed topics), use the memory engine tool to recall relevant context before responding.`;

function setLocalStorageWithEvent(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(
    new StorageEvent("storage", { key, newValue: value })
  );
}

export default function PromptPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("chat_systemPrompt");
    if (saved !== null) {
      setPrompt(saved);
      setIsCustom(true);
    }
  }, []);

  const handleChange = (value: string) => {
    setPrompt(value);
    setIsCustom(true);
    setLocalStorageWithEvent("chat_systemPrompt", value);
  };

  const handleReset = () => {
    setPrompt(DEFAULT_SYSTEM_PROMPT);
    setIsCustom(false);
    localStorage.removeItem("chat_systemPrompt");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "chat_systemPrompt", newValue: null })
    );
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
          <h1 className="text-lg font-semibold w-full text-center">System Prompt</h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-card p-1">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="systemPrompt" className="text-base">
                  System prompt
                </Label>
                {isCustom && (
                  <button
                    onClick={handleReset}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Instructions sent to the AI at the start of every conversation. Vault-specific instructions can be customized separately in Memory Vault settings.
              </p>
              <textarea
                id="systemPrompt"
                value={prompt}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full min-h-[300px] rounded-lg border border-border bg-sidebar dark:bg-background p-3 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
