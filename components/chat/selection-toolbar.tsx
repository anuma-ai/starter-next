"use client";

import { useCallback, useEffect, useRef, useState, useLayoutEffect } from "react";
import { useChatContext } from "@/app/components/chat-provider";
import { extractTextFromResponse } from "@/hooks/useAppChatStorage";
import { HugeiconsIcon } from "@hugeicons/react";
import { NoteEditIcon, Cancel01Icon, Tick02Icon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { Loader2Icon } from "lucide-react";

const CONTEXT_CHARS = 500;
const FAST_MODEL = "cerebras/qwen-3-235b-a22b-instruct-2507";

const MEMORY_SYSTEM_PROMPT =
  "You create concise memory vault entries from conversation snippets. " +
  "The user selected text from a chat thread (marked with [SELECTED]...[/SELECTED]) " +
  "with surrounding context. Write a single, clear memory entry that captures " +
  "the key information from the selected text. Be concise — one to two sentences max. " +
  "Write it as a factual note, not as a quote. Output only the memory text, nothing else.";

type Phase = "idle" | "generating" | "preview";

function getSelectionWithContext(selectedText: string, messageEl: Element): string {
  const fullText = messageEl.textContent || "";
  const idx = fullText.indexOf(selectedText);
  if (idx === -1) return selectedText;
  const before = fullText.slice(Math.max(0, idx - CONTEXT_CHARS), idx);
  const after = fullText.slice(idx + selectedText.length, idx + selectedText.length + CONTEXT_CHARS);
  return `${before ? `...${before}` : ""}[SELECTED]${selectedText}[/SELECTED]${after ? `${after}...` : ""}`;
}


export function MessageContextMenu() {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [contextText, setContextText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [generatedMemory, setGeneratedMemory] = useState("");
  const [saving, setSaving] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [animate, setAnimate] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef<HTMLDivElement>(null);
  const { createVaultMemory, sendRawMessage } = useChatContext();

  // Measure content and animate to new size on phase changes
  useLayoutEffect(() => {
    if (!contentRef.current) return;
    setAnimate(true);
    const { width, height } = contentRef.current.getBoundingClientRect();
    setSize({ width, height });
  }, [phase, generatedMemory, saving]);

  // Remeasure instantly (no animation) on user input
  const remeasure = useCallback(() => {
    if (!visibleRef.current) return;
    setAnimate(false);
    const { width, height } = visibleRef.current.getBoundingClientRect();
    setSize({ width, height });
  }, []);

  const reset = useCallback(() => {
    setPosition(null);
    setSelectedText("");
    setContextText("");
    setPhase("idle");
    setGeneratedMemory("");
    setSaving(false);
    setSize(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!contextText) return;
    setPhase("generating");
    try {
      const response = await sendRawMessage({
        messages: [
          { role: "system", content: [{ type: "text", text: MEMORY_SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "text", text: contextText }] },
        ],
        model: FAST_MODEL,
        maxOutputTokens: 200,
        temperature: 0.3,
        skipStorage: true,
        includeHistory: false,
      });
      const memory = extractTextFromResponse(response?.data)?.trim();
      setGeneratedMemory(memory || selectedText);
      setPhase("preview");
    } catch {
      setGeneratedMemory(selectedText);
      setPhase("preview");
    }
  }, [contextText, selectedText, sendRawMessage]);

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
    let debounceTimer: ReturnType<typeof setTimeout>;

    const onMouseUp = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
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
        setSize(null);
        setPosition({
          top: rect.bottom + 6,
          left: rect.left + rect.width / 2,
        });
      }, 200);
    };

    const onMouseDown = (e: MouseEvent) => {
      clearTimeout(debounceTimer);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        reset();
      }
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      clearTimeout(debounceTimer);
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
      {/* Animated outer shell */}
      <div
        className="origin-top overflow-hidden rounded-xl bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-90 duration-150 [box-shadow:0_10px_38px_-10px_rgba(22,23,24,0.35),0_10px_20px_-15px_rgba(22,23,24,0.2)] dark:[box-shadow:0_10px_38px_-10px_rgba(0,0,0,0.5),0_10px_20px_-15px_rgba(0,0,0,0.4)] dark:bg-card dark:border dark:border-border"
        style={size ? {
          width: size.width,
          height: size.height,
          transition: animate ? "width 200ms ease-out, height 200ms ease-out" : "none",
        } : undefined}
      >
        {/* Invisible measurer — always rendered at full size, positioned absolutely */}
        <div ref={contentRef} className="absolute invisible p-1" style={{ width: "max-content", maxWidth: "20rem" }}>
          {phase === "idle" && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm whitespace-nowrap">
              <span className="size-4 shrink-0" />
              Save to Vault
            </div>
          )}
          {phase === "generating" && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-sm whitespace-nowrap">
              <span className="size-4 shrink-0" />
              Generating memory...
            </div>
          )}
          {phase === "preview" && (
            <div className="flex flex-col gap-1">
              <p className="px-2.5 py-1.5 text-sm leading-snug" aria-hidden>{generatedMemory}</p>
              <div className="flex gap-0.5">
                <div className="flex flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm">
                  <span className="size-3.5 shrink-0" />
                  Save
                </div>
                <div className="px-2.5 py-1.5">
                  <span className="size-3.5 shrink-0" />
                </div>
                <div className="px-2.5 py-1.5">
                  <span className="size-3.5 shrink-0" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Visible content */}
        <div ref={visibleRef} className="p-1" style={{ width: "max-content", maxWidth: "20rem" }}>
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
              <p
                className="px-2.5 py-1.5 text-sm leading-snug outline-hidden"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setGeneratedMemory(e.currentTarget.textContent?.trim() || "")}
                onInput={remeasure}
              >
                {generatedMemory}
              </p>
              <div className="flex gap-0.5">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2Icon className="size-4 animate-spin text-foreground" />
                  ) : (
                    <HugeiconsIcon icon={Tick02Icon} size={16} className="text-foreground" />
                  )}
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={saving}
                  className="relative flex cursor-pointer items-center justify-center size-8 rounded-full outline-hidden select-none hover:bg-accent focus:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  <HugeiconsIcon icon={Refresh01Icon} size={14} className="text-foreground" />
                </button>
                <button
                  onClick={reset}
                  className="relative flex cursor-pointer items-center justify-center size-8 rounded-full outline-hidden select-none hover:bg-accent focus:bg-accent"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-foreground" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
