"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChatContext } from "@/app/components/chat-provider";
import { useIdentityToken } from "@privy-io/react-auth";
import { HugeiconsIcon } from "@hugeicons/react";
import { NoteEditIcon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { Loader2Icon, CheckIcon } from "lucide-react";

const CONTEXT_CHARS = 500;
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const FAST_MODEL = "cerebras/qwen-3-235b-a22b-instruct-2507";

type Phase = "idle" | "generating" | "preview";

function getSelectionWithContext(selectedText: string, messageEl: Element): string {
  const fullText = messageEl.textContent || "";
  const idx = fullText.indexOf(selectedText);
  if (idx === -1) return selectedText;
  const before = fullText.slice(Math.max(0, idx - CONTEXT_CHARS), idx);
  const after = fullText.slice(idx + selectedText.length, idx + selectedText.length + CONTEXT_CHARS);
  return `${before ? `...${before}` : ""}[SELECTED]${selectedText}[/SELECTED]${after ? `${after}...` : ""}`;
}

async function generateMemory(
  textWithContext: string,
  token: string,
): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: FAST_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You create concise memory vault entries from conversation snippets. " +
            "The user selected text from a chat thread (marked with [SELECTED]...[/SELECTED]) " +
            "with surrounding context. Write a single, clear memory entry that captures " +
            "the key information from the selected text. Be concise — one to two sentences max. " +
            "Write it as a factual note, not as a quote. Output only the memory text, nothing else.",
        },
        { role: "user", content: textWithContext },
      ],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error("Failed to generate memory");
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export function MessageContextMenu() {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [contextText, setContextText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [generatedMemory, setGeneratedMemory] = useState("");
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { createVaultMemory } = useChatContext();
  const { identityToken } = useIdentityToken();

  const reset = useCallback(() => {
    setPosition(null);
    setSelectedText("");
    setContextText("");
    setPhase("idle");
    setGeneratedMemory("");
    setSaving(false);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!contextText || !identityToken) return;
    setPhase("generating");
    try {
      const memory = await generateMemory(contextText, identityToken);
      setGeneratedMemory(memory);
      setPhase("preview");
    } catch {
      // Fall back to saving raw text
      setGeneratedMemory(selectedText);
      setPhase("preview");
    }
  }, [contextText, identityToken, selectedText]);

  const handleSave = useCallback(async () => {
    if (!generatedMemory || saving) return;
    setSaving(true);
    try {
      await createVaultMemory(generatedMemory);
      window.getSelection()?.removeAllRanges();
      reset();
    } catch {
      setSaving(false);
    }
  }, [generatedMemory, saving, createVaultMemory, reset]);

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;

      requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          if (phase === "idle") setPosition(null);
          return;
        }

        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer as HTMLElement;
        const messageEl =
          container.closest?.("[data-chat-message]") ??
          (container.parentElement?.closest?.("[data-chat-message]") ?? null);
        if (!messageEl) {
          if (phase === "idle") setPosition(null);
          return;
        }

        const text = sel.toString().trim();
        const rect = range.getBoundingClientRect();
        setSelectedText(text);
        setContextText(getSelectionWithContext(text, messageEl));
        setPhase("idle");
        setGeneratedMemory("");
        setPosition({
          top: rect.bottom + 6,
          left: rect.left + rect.width / 2,
        });
      });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        reset();
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [phase, reset]);

  if (!position) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 -translate-x-1/2"
      style={{ top: position.top, left: position.left }}
    >
      <div className="min-w-[8rem] max-w-[20rem] origin-top overflow-hidden rounded-xl p-1 bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-90 duration-150 [box-shadow:0_10px_38px_-10px_rgba(22,23,24,0.35),0_10px_20px_-15px_rgba(22,23,24,0.2)] dark:[box-shadow:0_10px_38px_-10px_rgba(0,0,0,0.5),0_10px_20px_-15px_rgba(0,0,0,0.4)] dark:bg-card dark:border dark:border-border">
        {phase === "idle" && (
          <button
            onClick={handleGenerate}
            className="relative flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0"
          >
            <HugeiconsIcon icon={NoteEditIcon} size={16} />
            Save to Vault
          </button>
        )}

        {phase === "generating" && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Generating memory...
          </div>
        )}

        {phase === "preview" && (
          <div className="flex flex-col gap-1">
            <p className="px-2.5 py-1.5 text-sm leading-snug">{generatedMemory}</p>
            <div className="flex gap-0.5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {saving ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <CheckIcon className="size-3.5" />
                )}
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={reset}
                className="relative flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
