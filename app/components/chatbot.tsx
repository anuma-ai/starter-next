"use client";

import { useState, useCallback, useEffect, useRef, Fragment } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Zip02Icon, DashboardSquare01Icon, Alert02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { ImageIcon, CpuIcon, FileTextIcon, FileSpreadsheetIcon, FileIcon, BrainIcon, AudioLinesIcon, SquareIcon } from "lucide-react";
import { ModelIcon } from "@/components/model-icons";
import { usePrivy } from "@privy-io/react-auth";

import { CHAT_INPUT_PLACEHOLDER_UNAUTHENTICATED } from "@/lib/constants";
import { MODELS, getModelConfig } from "@/lib/models";
import { useFiles, useVoice } from "@reverbia/sdk/react";
import { useDatabase } from "@/app/providers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Message,
  MessageContent,
  MessageResponse,
  StreamingMessage,
} from "@/components/chat/message";
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputButton,
  usePromptInputAttachments,
} from "@/components/chat/prompt-input";
import { Reasoning } from "@/components/chat/reasoning";
import { useChatContext } from "./chat-provider";
import { useThinkingPanel } from "./thinking-panel-provider";
import { useUIInteraction } from "@reverbia/sdk/react";
import { ChoiceInteraction } from "@/components/chat/choice-interaction";
import { FormInteraction } from "@/components/chat/form-interaction";
import { WeatherCard } from "@/components/chat/weather-card";
import { ChartCard } from "@reverbia/sdk/react";
import { useChatPatternWithProject } from "@/lib/chat-pattern";
import { useProjectTheme } from "@/hooks/useProjectTheme";
import { applyTheme, getStoredThemeId } from "@/hooks/useTheme";
import {
  collectDisplayInteractions,
  getDisplaysForMessage,
  getUnanchoredDisplays,
  useDisplayPersistence,
} from "@/lib/display-interaction";

function getErrorTitle(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("timeout") || e.includes("etimedout")) return "Request timed out";
  if (e.includes("rate limit") || e.includes("429")) return "Rate limit exceeded";
  if (e.includes("authenticat") || e.includes("unauthorized") || e.includes("401")) return "Authentication error";
  if (e.includes("payment") || e.includes("402") || e.includes("out of credits")) return "Out of credits";
  if (e.includes("connect") || e.includes("econnrefused") || e.includes("econnreset") || e.includes("fetch failed") || e.includes("failed to fetch")) return "Connection error";
  if (e.includes("invalid request") || e.includes("bad request") || e.includes("400")) return "Invalid request";
  if (e.includes("500") || e.includes("server") || e.includes("internal")) return "Server error";
  if (e.includes("502") || e.includes("503") || e.includes("504")) return "Service unavailable";
  return `Something went wrong: ${error}`;
}

type PromptMenuProps = {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  thinkingEnabled: boolean;
  onToggleThinking: () => void;
};

const PromptMenu = ({ selectedModel, onSelectModel, thinkingEnabled, onToggleThinking }: PromptMenuProps) => {
  const attachments = usePromptInputAttachments();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PromptInputButton>
          <HugeiconsIcon icon={DashboardSquare01Icon} className="size-5" />
        </PromptInputButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="overflow-hidden">
        <DropdownMenuItem onClick={() => attachments.openFileDialog()}>
          <ImageIcon className="size-4" />
          Add photos & files
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={onToggleThinking}>
          <BrainIcon className="size-4" />
          <span>Thinking</span>
          <Switch
            checked={thinkingEnabled}
            onCheckedChange={onToggleThinking}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto"
          />
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CpuIcon className="size-4" />
            Select model
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {MODELS.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => onSelectModel(model.id)}
              >
                <ModelIcon modelId={model.id} className="size-4" />
                {model.name}
                <HugeiconsIcon icon={Tick02Icon} className={`size-4 ml-auto text-black ${selectedModel === model.id ? "" : "invisible"}`} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Cache helpers for conversation -> projectId mapping
// This enables synchronous theme application on navigation
const CONV_PROJECT_CACHE_KEY = (convId: string) => `conv_project_${convId}`;

function getCachedProjectId(conversationId: string | null): string | null {
  if (!conversationId || typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CONV_PROJECT_CACHE_KEY(conversationId));
  } catch {
    return null;
  }
}

function setCachedProjectId(conversationId: string, projectId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = CONV_PROJECT_CACHE_KEY(conversationId);
    if (projectId) {
      localStorage.setItem(key, projectId);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

const ChatBotDemo = () => {
  const pathname = usePathname();
  const router = useRouter();
  const chatState = useChatContext();
  const { authenticated, user } = usePrivy();
  const thinkingPanel = useThinkingPanel();
  const uiInteraction = useUIInteraction();
  const hasRedirectedRef = useRef(false);
  const database = useDatabase();
  const walletAddress = user?.wallet?.address;

  // Use SDK's useFiles hook for resolving file placeholders in messages
  const { resolveFilePlaceholders } = useFiles({
    database,
    walletAddress,
  });

  // Voice input
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceClosing, setIsVoiceClosing] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const { transcribe, preloadModel, isModelLoaded } = useVoice();

  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStartRef = useRef(0);
  const voiceActiveRef = useRef(false);
  const voiceTextRef = useRef("");
  const voiceAudioCtxRef = useRef<AudioContext | null>(null);
  const voiceMonitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceSilenceRef = useRef<number | null>(null);
  const voiceProcessingRef = useRef(false);

  // Voice chat mode (continuous conversation loop)
  const [voiceChatMode, setVoiceChatMode] = useState(false);
  const voiceChatModeRef = useRef(false);
  const startVoiceChatRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const voiceChatAutoSendRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("voice_enabled");
    setVoiceEnabled(saved === "true");
    // Restore voice chat mode if we navigated here from the home page mid-voice-chat
    if (sessionStorage.getItem("voiceChatPending") === "true") {
      sessionStorage.removeItem("voiceChatPending");
      voiceChatModeRef.current = true;
      setVoiceChatMode(true);
    }
  }, []);

  useEffect(() => {
    if (voiceEnabled && !isModelLoaded) {
      preloadModel();
    }
  }, [voiceEnabled, isModelLoaded, preloadModel]);

  // Clean up voice resources on unmount to prevent mic/AudioContext/interval leaks
  useEffect(() => {
    return () => {
      voiceActiveRef.current = false;
      voiceChatModeRef.current = false;
      if (voiceMonitorRef.current) {
        clearInterval(voiceMonitorRef.current);
        voiceMonitorRef.current = null;
      }
      voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
      voiceStreamRef.current = null;
      voiceAudioCtxRef.current?.close();
      voiceAudioCtxRef.current = null;
    };
  }, []);

  const startVoiceChunk = useCallback((stream: MediaStream) => {
    const mimeType = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    voiceChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) voiceChunksRef.current.push(e.data);
    };
    recorder.start();
    voiceStartRef.current = Date.now();
    voiceRecorderRef.current = recorder;
  }, []);

  const stopVoiceChunk = useCallback((): Promise<{ blob: Blob; duration: number; mimeType: string } | null> => {
    return new Promise((resolve) => {
      const recorder = voiceRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        if (voiceChunksRef.current.length === 0) {
          resolve(null);
          return;
        }
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(voiceChunksRef.current, { type: mimeType });
        const duration = Date.now() - voiceStartRef.current;
        voiceChunksRef.current = [];
        resolve({ blob, duration, mimeType });
      };
      recorder.stop();
    });
  }, []);

  // Get conversationId early to determine if this is a new chat
  const { conversationId: currentConversationId } = chatState;

  // Apply theme SYNCHRONOUSLY at start of render to prevent flash
  // - For new chat (no conversationId): apply global theme
  // - For existing conversation: check cache for projectId and apply its theme
  if (typeof window !== "undefined") {
    if (!currentConversationId) {
      applyTheme(getStoredThemeId());
    } else {
      const cachedProjectId = getCachedProjectId(currentConversationId);
      if (cachedProjectId) {
        // Apply project theme synchronously from cache
        try {
          const stored = localStorage.getItem(`project_theme_${cachedProjectId}`);
          const settings = stored ? JSON.parse(stored) : {};
          if (settings.colorTheme) {
            applyTheme(settings.colorTheme);
          } else {
            applyTheme(getStoredThemeId());
          }
        } catch {
          applyTheme(getStoredThemeId());
        }
      }
      // If no cache, theme will be applied after async fetch (small flash on first visit)
    }
  }

  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0].id);

  // Track current conversation's projectId for theme inheritance
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectIdDetermined, setProjectIdDetermined] = useState(false);

  // Load saved model preference from localStorage after mount to avoid SSR/hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem("chat_selectedModel");
    if (saved && MODELS.some((m) => m.id === saved)) {
      setSelectedModel(saved);
    }
  }, []);

  // Load saved thinking preference from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem("chat_thinkingEnabled");
    if (saved !== null) {
      setThinkingEnabled(saved === "true");
    }
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem("chat_selectedModel", modelId);
  }, []);

  const handleToggleThinking = useCallback(() => {
    setThinkingEnabled((prev) => {
      const newValue = !prev;
      localStorage.setItem("chat_thinkingEnabled", String(newValue));
      return newValue;
    });
  }, []);

  // Note: File preprocessing (PDF, Excel, Word) is now handled automatically
  // by the SDK via useChatStorage's fileProcessors option. No need for manual
  // usePdf() or useOCR() calls here.

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    addMessageOptimistically,
    isLoading,
    status,
    error,
    subscribeToStreaming,
    subscribeToThinking,
    conversationId,
    setConversationId,
    getConversation,
    createConversation,
    stop,
  } = chatState;

  const inputRef = useRef(input);
  inputRef.current = input;

  // Clear interactive (non-display) UI interactions when conversation changes
  // to prevent cross-conversation leaks. Display interactions are left alone
  // and replaced by the persistence hook, avoiding a flash of empty state.
  useEffect(() => {
    for (const [id, interaction] of uiInteraction.pendingInteractions) {
      if (interaction.type !== "display") {
        uiInteraction.cancelInteraction(id);
      }
    }
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist display interactions to localStorage so they survive page refresh
  useDisplayPersistence(uiInteraction, conversationId, messages);

  // Fetch conversation's projectId when conversationId changes
  useEffect(() => {
    // Reset determination state when conversation changes
    setProjectIdDetermined(false);

    if (!conversationId) {
      setCurrentProjectId(null);
      setProjectIdDetermined(true);
      return;
    }

    const fetchProjectId = async () => {
      try {
        const conversation = await getConversation(conversationId);
        const projectId = conversation?.projectId || null;
        setCurrentProjectId(projectId);
        // Cache the projectId for synchronous theme application on future visits
        setCachedProjectId(conversationId, projectId);
      } catch {
        setCurrentProjectId(null);
      }
      setProjectIdDetermined(true);
    };

    fetchProjectId();
  }, [conversationId, getConversation]);

  // Get project theme settings (returns empty settings if no projectId)
  const { settings: projectTheme, settingsLoaded, loadedForProjectId } = useProjectTheme(currentProjectId);

  // Apply project color theme to entire app when viewing a conversation in this project
  // Wait until projectId is determined AND settings are loaded for the correct projectId
  useEffect(() => {
    if (!projectIdDetermined || !settingsLoaded) return;

    // Ensure settings are loaded for the current projectId to prevent flash during transitions
    // When currentProjectId changes, loadedForProjectId will be stale until the effect runs
    if (currentProjectId !== null && loadedForProjectId !== currentProjectId) return;

    if (projectTheme.colorTheme) {
      applyTheme(projectTheme.colorTheme);
    } else {
      // No project override - apply global theme
      applyTheme(getStoredThemeId());
    }
  }, [projectIdDetermined, settingsLoaded, loadedForProjectId, currentProjectId, projectTheme.colorTheme]);

  // Check if settings are ready (loaded for the correct projectId)
  const isSettingsReady = projectIdDetermined && settingsLoaded &&
    (currentProjectId === null || loadedForProjectId === currentProjectId);

  // Use project-aware pattern hook with optional project overrides
  const computedPatternStyle = useChatPatternWithProject(
    projectTheme.colorTheme,
    projectTheme.iconTheme
  );

  // Keep the last valid pattern during transitions to prevent flickering
  // This is especially important when switching between chats in the same project
  const lastValidPatternRef = useRef<React.CSSProperties | null>(null);
  if (isSettingsReady) {
    lastValidPatternRef.current = computedPatternStyle;
  }
  // Use the cached pattern if available, otherwise fall back to computed pattern
  // This ensures we always show a pattern (computed is always valid, just might be global during transitions)
  const patternStyle = lastValidPatternRef.current ?? computedPatternStyle;

  const [streamingThinking, setStreamingThinking] = useState<string>("");
  const [streamingText, setStreamingText] = useState<string>("");
  const [thinkingDuration, setThinkingDuration] = useState<number | undefined>(
    undefined
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const thinkingStartTimeRef = useRef<number | null>(null);
  const thinkingEnabledBeforeAutoRef = useRef<boolean | null>(null);

  const handleFilesChange = useCallback(
    (files: { mediaType?: string }[]) => {
      // Only auto-enable thinking for image files — images need a vision-capable model
      // (Fireworks). Non-image files (PDF, DOCX, XLSX, ZIP) are preprocessed client-side
      // by the SDK into text, so the fast model (Cerebras) handles them fine.
      const hasImages = files.some((f) => f.mediaType?.startsWith("image/"));
      if (hasImages && !thinkingEnabled) {
        thinkingEnabledBeforeAutoRef.current = false;
        setThinkingEnabled(true);
        localStorage.setItem("chat_thinkingEnabled", "true");
      } else if (!hasImages && thinkingEnabledBeforeAutoRef.current === false) {
        thinkingEnabledBeforeAutoRef.current = null;
        setThinkingEnabled(false);
        localStorage.setItem("chat_thinkingEnabled", "false");
      }
    },
    [thinkingEnabled]
  );

  useEffect(() => {
    const unsubscribe = subscribeToThinking((text: string) => {
      setStreamingThinking(text);
      // Start timing when thinking begins
      if (text && thinkingStartTimeRef.current === null) {
        thinkingStartTimeRef.current = Date.now();
      }
    });
    return unsubscribe;
  }, [subscribeToThinking]);

  useEffect(() => {
    const unsubscribe = subscribeToStreaming((text: string) => {
      setStreamingText(text);
      // When streaming text starts and we were thinking, calculate duration
      if (text && thinkingStartTimeRef.current !== null) {
        const duration = Math.ceil(
          (Date.now() - thinkingStartTimeRef.current) / 1000
        );
        setThinkingDuration(duration);
        thinkingStartTimeRef.current = null;
      }
    });
    return unsubscribe;
  }, [subscribeToStreaming]);

  useEffect(() => {
    if (isLoading) {
      setStreamingThinking("");
      setStreamingText("");
      setThinkingDuration(undefined);
      thinkingStartTimeRef.current = null;
    } else {
      // Reset submitting state when loading completes
      setIsSubmitting(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (
      conversationId &&
      pathname === "/" &&
      messages.length > 0 &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      router.replace(`/c/${conversationId}`);
    }
  }, [conversationId, pathname, messages.length, router]);

  useEffect(() => {
    if (pathname === "/") {
      hasRedirectedRef.current = false;
    }
  }, [pathname]);

  const onSubmit = useCallback(
    async (message: PromptInputMessage) => {
      // Show loading indicator immediately
      setIsSubmitting(true);

      // For new conversations from home page, create conversation and navigate FIRST
      // This pattern ensures the user sees the conversation page immediately
      let targetConversationId = conversationId;
      if (pathname === "/" && !conversationId) {
        const conv = await createConversation({ createImmediately: true });
        if (conv?.conversationId) {
          targetConversationId = conv.conversationId;
          // Navigate IMMEDIATELY - don't wait for message to complete
          router.replace(`/c/${conv.conversationId}`);
        }
      }

      // Step 1: Add user message optimistically
      addMessageOptimistically(message.text, message.files, message.text);
      setInput(""); // Clear input immediately for instant feedback

      // Step 2: File preprocessing is now handled automatically by useChatStorage
      // The SDK will extract text from PDF, Excel, and Word files automatically
      // No need for manual processing here

      // Step 3: Send to API (skip adding user message to UI again since we already did)
      // Get the resolved model config based on thinking toggle
      // Force thinking mode for image attachments — Anuma Fast (Cerebras) has no vision support,
      // so we route to the thinking variant (e.g. Fireworks) which does.
      const hasImages = message.files?.some((f) => f.mediaType?.startsWith("image/"));
      const effectiveThinking = hasImages || thinkingEnabled;
      const modelConfig = getModelConfig(selectedModel, effectiveThinking);
      // Persist voice chat mode across navigation (home → conversation page remount)
      if (voiceChatModeRef.current && voiceEnabled && isModelLoaded) {
        sessionStorage.setItem("voiceChatPending", "true");
      }

      await handleSubmit(
        {
          ...message,
          text: message.text,
          displayText: message.text,
          files: message.files,
        },
        {
          model: modelConfig?.modelId ?? selectedModel,
          apiType: modelConfig?.apiType,
          maxOutputTokens: 32000,
          toolChoice: "auto",
          // Only include reasoning params for models that use API-level reasoning (Claude, GPT)
          ...(effectiveThinking && modelConfig?.useReasoning && {
            reasoning: { effort: "high", summary: "detailed" },
            thinking: { type: "enabled", budget_tokens: 10000 },
          }),
          skipOptimisticUpdate: true,
          // Pass the conversation ID explicitly so memory tool can exclude it
          conversationId: targetConversationId ?? undefined,
        }
      );

    },
    [handleSubmit, addMessageOptimistically, setInput, selectedModel, thinkingEnabled, pathname, router, conversationId, createConversation, voiceEnabled, isModelLoaded]
  );

  const processVoiceChunk = useCallback(async (stream: MediaStream) => {
    if (voiceProcessingRef.current) return;
    voiceProcessingRef.current = true;
    const recording = await stopVoiceChunk();
    // Restart recording immediately so no audio is lost during transcription
    if (voiceActiveRef.current) {
      startVoiceChunk(stream);
    }
    if (recording && recording.duration > 500) {
      try {
        const { text } = await transcribe(recording);
        const cleaned = text?.replace(/\[.*?\]|\(.*?\)/g, "").trim();
        if (cleaned) {
          // Sync with what the user actually sees in the input field
          voiceTextRef.current = inputRef.current;
          voiceTextRef.current += (voiceTextRef.current ? " " : "") + cleaned;
          setInput(voiceTextRef.current);
        }
      } catch { }
    }
    voiceProcessingRef.current = false;
  }, [stopVoiceChunk, transcribe, setInput, startVoiceChunk]);

  const cleanupVoice = useCallback(() => {
    if (voiceMonitorRef.current) {
      clearInterval(voiceMonitorRef.current);
      voiceMonitorRef.current = null;
    }
    voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
    voiceStreamRef.current = null;
    voiceAudioCtxRef.current?.close();
    voiceAudioCtxRef.current = null;
  }, []);

  // Voice chat: stop recording, transcribe, auto-submit, and restart after AI responds
  const voiceChatAutoSend = useCallback(async () => {
    if (voiceProcessingRef.current) return;
    voiceProcessingRef.current = true;

    try {
      const recording = await stopVoiceChunk();

      if (recording && recording.duration > 500) {
        try {
          const { text } = await transcribe(recording);
          const cleaned = text?.replace(/\[.*?\]|\(.*?\)/g, "").trim();
          if (cleaned) {
            voiceTextRef.current += (voiceTextRef.current ? " " : "") + cleaned;
          }
        } catch { }
      }

      // Clean up current recording session
      if (voiceMonitorRef.current) {
        clearInterval(voiceMonitorRef.current);
        voiceMonitorRef.current = null;
      }
      voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
      voiceStreamRef.current = null;
      voiceAudioCtxRef.current?.close();
      voiceAudioCtxRef.current = null;

      const finalText = voiceTextRef.current.trim();
      voiceTextRef.current = "";

      voiceActiveRef.current = false;
      setIsVoiceActive(false);
      setVoiceLevel(0);

      voiceProcessingRef.current = false;

      if (finalText && voiceChatModeRef.current) {
        setInput("");
        // Await onSubmit so we know when the AI finishes responding
        await onSubmit({ text: finalText, files: [] });
        // After AI responds, restart recording if still in voice chat mode
        if (voiceChatModeRef.current && !voiceActiveRef.current) {
          startVoiceChatRecordingRef.current?.();
        }
      } else if (voiceChatModeRef.current) {
        // No text captured (silence) — restart recording immediately
        startVoiceChatRecordingRef.current?.();
      }
    } catch {
      voiceProcessingRef.current = false;
      // On error, restart recording if still in voice chat mode
      if (voiceChatModeRef.current && !voiceActiveRef.current) {
        startVoiceChatRecordingRef.current?.();
      }
    }
  }, [stopVoiceChunk, transcribe, setInput, onSubmit]);

  // Keep ref in sync so interval always calls latest version
  voiceChatAutoSendRef.current = voiceChatAutoSend;

  // Voice chat: start recording with 2s silence threshold for auto-send
  const startVoiceChatRecording = useCallback(async () => {
    if (voiceActiveRef.current) return; // Already recording
    voiceTextRef.current = "";
    setInput("");
    voiceActiveRef.current = true;
    setIsVoiceActive(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      voiceAudioCtxRef.current = audioCtx;

      startVoiceChunk(stream);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      voiceSilenceRef.current = null;

      voiceMonitorRef.current = setInterval(() => {
        if (!voiceActiveRef.current || !voiceChatModeRef.current) return;
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setVoiceLevel(Math.min(rms * 10, 1));

        if (rms < 0.02) {
          if (voiceSilenceRef.current === null) {
            voiceSilenceRef.current = Date.now();
          } else if (Date.now() - voiceSilenceRef.current > 2000 && !voiceProcessingRef.current) {
            voiceSilenceRef.current = null;
            voiceChatAutoSendRef.current?.();
          }
        } else {
          voiceSilenceRef.current = null;
        }
      }, 100);
    } catch {
      // getUserMedia or AudioContext failed — reset so future attempts aren't blocked
      voiceActiveRef.current = false;
      setIsVoiceActive(false);
    }
  }, [setInput, startVoiceChunk]);

  // Keep ref in sync so useEffect can call it
  startVoiceChatRecordingRef.current = startVoiceChatRecording;

  const handleVoiceToggle = useCallback(async () => {
    if (isVoiceActive) {
      // Stop — start exit animation immediately
      voiceActiveRef.current = false;
      setIsVoiceClosing(true);
      setVoiceLevel(0);

      if (voiceMonitorRef.current) {
        clearInterval(voiceMonitorRef.current);
        voiceMonitorRef.current = null;
      }

      // Snapshot current resources before async work so cleanup targets
      // these specific instances, not resources from a new recording session
      const stream = voiceStreamRef.current;
      const audioCtx = voiceAudioCtxRef.current;
      voiceStreamRef.current = null;
      voiceAudioCtxRef.current = null;

      // Hide button after animation completes
      setTimeout(() => {
        setIsVoiceActive(false);
        setIsVoiceClosing(false);
      }, 200);

      // Transcribe final chunk in background
      const recording = await stopVoiceChunk();
      if (recording && recording.duration > 500) {
        try {
          const { text } = await transcribe(recording);
          const cleaned = text?.replace(/\[.*?\]|\(.*?\)/g, "").trim();
          if (cleaned) {
            voiceTextRef.current += (voiceTextRef.current ? " " : "") + cleaned;
          }
        } catch { }
      }

      // Clean up the snapshotted resources (safe even if a new session started)
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();

      const finalText = voiceTextRef.current.trim();
      voiceTextRef.current = "";

      if (finalText) {
        setInput(finalText);
      }
    } else {
      // Start – preserve any text the user already typed / edited
      voiceTextRef.current = inputRef.current;
      voiceActiveRef.current = true;
      setIsVoiceActive(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;

      // Audio analysis for silence detection
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      voiceAudioCtxRef.current = audioCtx;

      startVoiceChunk(stream);

      // Monitor audio levels for silence
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      voiceSilenceRef.current = null;

      voiceMonitorRef.current = setInterval(() => {
        if (!voiceActiveRef.current) return;
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setVoiceLevel(Math.min(rms * 10, 1));

        if (rms < 0.02) {
          if (voiceSilenceRef.current === null) {
            voiceSilenceRef.current = Date.now();
          } else if (Date.now() - voiceSilenceRef.current > 1200 && !voiceProcessingRef.current) {
            voiceSilenceRef.current = null;
            processVoiceChunk(stream);
          }
        } else {
          voiceSilenceRef.current = null;
        }
      }, 100);
    }
  }, [isVoiceActive, stopVoiceChunk, transcribe, setInput, startVoiceChunk, processVoiceChunk, cleanupVoice]);

  // Toggle voice chat mode on/off
  const handleVoiceChatToggle = useCallback(async () => {
    if (voiceChatMode) {
      // Exit voice chat mode
      voiceChatModeRef.current = false;
      setVoiceChatMode(false);

      // If currently recording, stop everything
      if (isVoiceActive) {
        voiceActiveRef.current = false;
        setIsVoiceClosing(true);
        setVoiceLevel(0);

        if (voiceMonitorRef.current) {
          clearInterval(voiceMonitorRef.current);
          voiceMonitorRef.current = null;
        }

        setTimeout(() => {
          setIsVoiceActive(false);
          setIsVoiceClosing(false);
        }, 200);

        await stopVoiceChunk();
        cleanupVoice();
        voiceTextRef.current = "";
      }
    } else {
      // Enter voice chat mode and start recording
      voiceChatModeRef.current = true;
      setVoiceChatMode(true);
      await startVoiceChatRecording();
    }
  }, [voiceChatMode, isVoiceActive, stopVoiceChunk, cleanupVoice, startVoiceChatRecording]);

  // Stop recording, transcribe, submit combined text, enter voice chat mode
  const handleVoiceChat = useCallback(async () => {
    if (!isVoiceActive) return;

    // Stop recording
    voiceActiveRef.current = false;
    setIsVoiceClosing(true);
    setVoiceLevel(0);

    if (voiceMonitorRef.current) {
      clearInterval(voiceMonitorRef.current);
      voiceMonitorRef.current = null;
    }

    setTimeout(() => {
      setIsVoiceActive(false);
      setIsVoiceClosing(false);
    }, 200);

    // Sync with what the user actually sees in the input field (they may have edited it)
    voiceTextRef.current = inputRef.current;

    // Transcribe final chunk
    const recording = await stopVoiceChunk();
    if (recording && recording.duration > 500) {
      try {
        const { text } = await transcribe(recording);
        const cleaned = text?.replace(/\[.*?\]|\(.*?\)/g, "").trim();
        if (cleaned) {
          voiceTextRef.current += (voiceTextRef.current ? " " : "") + cleaned;
        }
      } catch { }
    }

    cleanupVoice();

    const finalText = voiceTextRef.current.trim();
    voiceTextRef.current = "";

    if (finalText) {
      // Enter voice chat mode so the auto-restart useEffect picks up after the response
      voiceChatModeRef.current = true;
      setVoiceChatMode(true);
      setInput("");
      onSubmit({ text: finalText, files: [] });
    }
  }, [isVoiceActive, stopVoiceChunk, transcribe, cleanupVoice, setInput, onSubmit]);

  // Auto-start voice chat after AI response completes (handles remount after navigation)
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && voiceChatModeRef.current && voiceEnabled && isModelLoaded && !voiceActiveRef.current) {
      voiceChatModeRef.current = true;
      setVoiceChatMode(true);
      startVoiceChatRecordingRef.current?.();
    }
    wasLoadingRef.current = isLoading;
    // Note: uses voiceActiveRef (not isVoiceActive state) to avoid spurious runs
    // that reset wasLoadingRef when voice active state changes while isLoading is false
  }, [isLoading, voiceEnabled, isModelLoaded]);

  // Fallback: if wasLoadingRef misses the isLoading transition (e.g. React batches
  // true→false), this delayed effect catches it for existing chats.
  useEffect(() => {
    if (!isLoading && voiceChatModeRef.current && voiceEnabled && isModelLoaded && !voiceActiveRef.current) {
      const timer = setTimeout(() => {
        if (voiceChatModeRef.current && !voiceActiveRef.current) {
          startVoiceChatRecordingRef.current?.();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, voiceEnabled, isModelLoaded]);

  // Detect when we expect messages but don't have them yet (to avoid flashing the
  // centered empty-chat prompt). This covers:
  // - Direct URL load: pathname is /c/... but messages haven't loaded yet
  // - Switching conversations: conversationId is set but messages haven't arrived yet
  const expectsMessages = pathname.startsWith("/c/") || !!currentConversationId;
  const showEmptyState = messages.length === 0 && !expectsMessages;

  return (
    <div
      className={`relative flex min-h-0 min-w-0 flex-1 flex-col bg-background ${showEmptyState ? "justify-center" : ""
        }`}
      style={patternStyle}
    >
      <div
        className={`min-h-0 flex-1 px-4 overflow-y-auto ${showEmptyState ? "hidden" : ""
          }`}
      >
        <div className="mx-auto max-w-3xl pb-52 flex flex-col gap-8 p-4">
          {(() => {
            // Build a queue of resolved interactions for inline rendering
            const resolvedInteractions = Array.from(uiInteraction.pendingInteractions.values())
              .filter(i => (i.type === "choice" || i.type === "form") && i.resolved)
              .sort((a, b) => a.createdAt - b.createdAt);
            let resolvedIdx = 0;
            const renderedInlineIds = new Set<string>();

            // Display-only interactions (e.g. weather cards)
            const displayInteractions = collectDisplayInteractions(uiInteraction.pendingInteractions);
            const renderedDisplayIds = new Set<string>();

            return messages.map((message: any) => {
            // At tool result message positions, render custom components instead of raw text
            if (message.role === "user" && message.parts.length > 0 && message.parts[0].type === "text") {
              const text = message.parts[0].text || "";

              // Display tool results are rendered via the interaction system
              // (persisted in localStorage), not from [Tool Execution Results] messages
              if (text.includes("[Tool Execution Results]") && (text.includes("display_weather") || text.includes("display_chart"))) {
                return null;
              }

              if (text.includes("[Tool Execution Results]") && (text.includes("prompt_user_choice") || text.includes("prompt_user_form"))) {
                const interaction = resolvedInteractions[resolvedIdx];
                if (interaction) {
                  resolvedIdx++;
                  renderedInlineIds.add(interaction.id);
                  if (interaction.type === "form") {
                    return (
                      <div key={message.id}>
                        <FormInteraction
                          id={interaction.id}
                          title={interaction.data.title}
                          description={interaction.data.description}
                          fields={interaction.data.fields}
                          resolved={true}
                          result={interaction.result}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={message.id}>
                      <ChoiceInteraction
                        id={interaction.id}
                        title={interaction.data.title}
                        description={interaction.data.description}
                        options={interaction.data.options}
                        allowMultiple={interaction.data.allowMultiple}
                        resolved={true}
                        result={interaction.result}
                      />
                    </div>
                  );
                }
                // Fallback: parse result from persisted message and render the
                // same components used during the live session for consistent styling.
                try {
                  const choiceMatch = text.match(/Tool "prompt_user_choice" returned: (.+)/);
                  if (choiceMatch) {
                    const parsed = JSON.parse(choiceMatch[1]);
                    const meta = parsed._meta || {};
                    return (
                      <div key={message.id}>
                        <ChoiceInteraction
                          id={message.id}
                          title={meta.title || ""}
                          description={meta.description}
                          options={meta.options || []}
                          allowMultiple={meta.allowMultiple}
                          resolved={true}
                          result={parsed}
                        />
                      </div>
                    );
                  }
                  const formMatch = text.match(/Tool "prompt_user_form" returned: (.+)/);
                  if (formMatch) {
                    const parsed = JSON.parse(formMatch[1]);
                    const meta = parsed._meta || {};
                    return (
                      <div key={message.id}>
                        <FormInteraction
                          id={message.id}
                          title={meta.title || ""}
                          description={meta.description}
                          fields={meta.fields || []}
                          resolved={true}
                          result={parsed}
                        />
                      </div>
                    );
                  }
                } catch {}
                return null;
              }

              // Hide remaining [Tool Execution Results] (server-side tools, etc.)
              if (text.includes("[Tool Execution Results]")) {
                return null;
              }
            }

            // Compute message content (shared between normal and injection paths)
            const messageContent = message.parts.map((part: any, i: number) => {
                switch (part.type) {
                  case "text": {
                    const isLastAssistantMessage =
                      message.role === "assistant" &&
                      message.id === messages.at(-1)?.id;

                    // Only use StreamingMessage when actively streaming.
                    // Streamdown (used by StreamingMessage) defers its first render via
                    // startTransition, causing a blank frame on mount. Using MessageResponse
                    // for loaded messages avoids this flash on conversation switch.
                    const useStreaming = isLastAssistantMessage && isLoading;

                    // Show reasoning after streaming starts (or completes) if there was thinking
                    // Only for assistant messages
                    const showReasoning =
                      message.role === "assistant" &&
                      isLastAssistantMessage &&
                      streamingThinking &&
                      (streamingText || !isLoading);

                    // Show loading indicator inside message when waiting for response
                    // Keep showing until streaming text actually starts
                    // Only for assistant messages
                    const showInlineLoader =
                      message.role === "assistant" &&
                      isLastAssistantMessage &&
                      (isSubmitting || isLoading) &&
                      !streamingText &&
                      !error;

                    // Show error when there's a transient error from the current request
                    // Only for the last assistant message when not loading
                    // Stored errors are rendered via the "error" part type instead
                    const showError =
                      message.role === "assistant" &&
                      isLastAssistantMessage &&
                      !isLoading &&
                      !isSubmitting &&
                      !streamingText &&
                      error;

                    // For user messages, just render the message
                    if (message.role === "user") {
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse resolveFilePlaceholders={resolveFilePlaceholders}>
                              {part.text}
                            </MessageResponse>
                          </MessageContent>
                        </Message>
                      );
                    }

                    // For assistant messages, include loader and reasoning
                    return (
                      <div key={`${message.id}-${i}`}>
                        {/* Loading indicator: circle, or circle + "Thinking..." */}
                        {showInlineLoader && (
                          <div className="flex items-center gap-2 text-muted-foreground text-sm h-5">
                            <span className="inline-block size-3 rounded-full bg-foreground flex-shrink-0 animate-[scale-pulse_1.5s_ease-in-out_infinite]" />
                            {streamingThinking && <span>Thinking...</span>}
                          </div>
                        )}
                        {/* Error message when streaming fails or response is empty */}
                        {showError && (
                          <Message from={message.role}>
                            <MessageContent>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <HugeiconsIcon icon={Alert02Icon} className="size-5 flex-shrink-0" />
                                <span>{getErrorTitle(error || "")}</span>
                              </div>
                            </MessageContent>
                          </Message>
                        )}
                        {/* After streaming starts: show brain + "Thought for X seconds" if there was thinking */}
                        {showReasoning && (
                          <Reasoning
                            className="w-full mb-2"
                            isStreaming={false}
                            duration={thinkingDuration}
                            content={streamingThinking}
                            onOpen={thinkingPanel.openPanel}
                          />
                        )}
                        {/* Only show message content when we have text or streaming */}
                        {(part.text || streamingText) && (
                          <Message from={message.role}>
                            <MessageContent>
                              {useStreaming ? (
                                <StreamingMessage
                                  subscribe={subscribeToStreaming}
                                  initialText={part.text || ""}
                                  isLoading={false}
                                  resolveFilePlaceholders={resolveFilePlaceholders}
                                />
                              ) : (
                                <MessageResponse resolveFilePlaceholders={resolveFilePlaceholders}>
                                  {part.text}
                                </MessageResponse>
                              )}
                            </MessageContent>
                          </Message>
                        )}
                      </div>
                    );
                  }
                  case "file": {
                    const ext = part.filename?.split(".").pop()?.toLowerCase();
                    const isSpreadsheet = ext === "xlsx" || ext === "xls" || ext === "csv";
                    const isDocument = ext === "docx" || ext === "doc" || ext === "pdf" || ext === "txt";
                    const isArchive = ext === "zip";
                    const FileTypeIcon = isSpreadsheet ? FileSpreadsheetIcon : isDocument ? FileTextIcon : FileIcon;
                    const fileTypeLabel = isArchive ? "Archive" : isSpreadsheet ? "Spreadsheet" : isDocument ? "Document" : "File";
                    const iconBgColor = isArchive ? "bg-amber-500" : isSpreadsheet ? "bg-green-500" : "bg-blue-500";

                    // User files: no bubble
                    if (message.role === "user") {
                      return (
                        <div
                          key={`${message.id}-${i}`}
                          className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-2 pr-4 text-sm ml-auto w-fit mt-2"
                        >
                          <div className={`flex size-10 items-center justify-center rounded-lg ${iconBgColor}`}>
                            {isArchive ? (
                              <HugeiconsIcon icon={Zip02Icon} className="size-5 text-white" />
                            ) : (
                              <FileTypeIcon className="size-5 text-white" />
                            )}
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span className="truncate font-medium">
                              {part.filename}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fileTypeLabel}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    // Assistant files: with bubble
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <div className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-2 pr-4 text-sm">
                            <div className={`flex size-10 items-center justify-center rounded-lg ${iconBgColor}`}>
                              {isArchive ? (
                                <HugeiconsIcon icon={Zip02Icon} className="size-5 text-white" />
                              ) : (
                                <FileTypeIcon className="size-5 text-white" />
                              )}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="truncate font-medium">
                                {part.filename}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {fileTypeLabel}
                              </span>
                            </div>
                          </div>
                        </MessageContent>
                      </Message>
                    );
                  }
                  case "image_url":
                    // User images: no bubble
                    if (message.role === "user") {
                      return (
                        <img
                          key={`${message.id}-${i}`}
                          src={part.image_url?.url}
                          alt="Uploaded image"
                          className="max-h-60 max-w-[300px] rounded-lg object-contain ml-auto mt-2"
                        />
                      );
                    }
                    // Assistant images: with bubble
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <img
                            src={part.image_url?.url}
                            alt="Uploaded image"
                            className="max-h-60 max-w-[300px] rounded-lg object-contain"
                          />
                        </MessageContent>
                      </Message>
                    );
                  case "reasoning":
                    // Only show reasoning for assistant messages
                    if (message.role !== "assistant") return null;
                    return (
                      <Reasoning
                        key={`${message.id}-${i}`}
                        className="w-full"
                        isStreaming={false}
                        content={part.text}
                        onOpen={thinkingPanel.openPanel}
                      />
                    );
                  case "error":
                    return (
                      <div key={`${message.id}-${i}`} className="flex items-center gap-2 text-muted-foreground text-sm">
                        <HugeiconsIcon icon={Alert02Icon} className="size-5 flex-shrink-0" />
                        <span>{getErrorTitle(part.error)}</span>
                      </div>
                    );
                  case "image":
                    return (
                      <Message key={`${message.id}-${i}`} from={message.role}>
                        <MessageContent>
                          <img
                            src={part.url}
                            alt="Generated image"
                            className="rounded-lg max-w-full"
                          />
                        </MessageContent>
                      </Message>
                    );
                  default:
                    return null;
                }
              });

            // Inject resolved interactions before the message they were anchored to
            // This ensures the choice summary appears above the follow-up response
            const interactionsBeforeThisMsg = resolvedInteractions.filter(
              i => !renderedInlineIds.has(i.id) && i.data.afterMessageId === message.id
            );

            // Display interactions anchored to this message (e.g. weather cards)
            const displaysBeforeThisMsg = getDisplaysForMessage(message.id, displayInteractions, renderedDisplayIds);

            const hasInjections = interactionsBeforeThisMsg.length > 0 || displaysBeforeThisMsg.length > 0;

            if (hasInjections) {
              interactionsBeforeThisMsg.forEach(i => renderedInlineIds.add(i.id));
              return (
                <Fragment key={message.id}>
                  {interactionsBeforeThisMsg.map(interaction =>
                    interaction.type === "form" ? (
                      <FormInteraction
                        key={interaction.id}
                        id={interaction.id}
                        title={interaction.data.title}
                        description={interaction.data.description}
                        fields={interaction.data.fields}
                        resolved={true}
                        result={interaction.result}
                      />
                    ) : (
                      <ChoiceInteraction
                        key={interaction.id}
                        id={interaction.id}
                        title={interaction.data.title}
                        description={interaction.data.description}
                        options={interaction.data.options}
                        allowMultiple={interaction.data.allowMultiple}
                        resolved={true}
                        result={interaction.result}
                      />
                    )
                  )}
                  {displaysBeforeThisMsg.map(interaction =>
                    interaction.data.displayType === "weather" ? (
                      <WeatherCard key={interaction.id} data={interaction.result} />
                    ) : interaction.data.displayType === "chart" ? (
                      <ChartCard key={interaction.id} data={interaction.result} />
                    ) : null
                  )}
                  <div>{messageContent}</div>
                </Fragment>
              );
            }

            return <div key={message.id}>{messageContent}</div>;
          });
          })()}
          {/* File preprocessing is now handled automatically by the SDK */}
          {/* Standalone loading indicator when submitting but before assistant message appears */}
          {isSubmitting && !isLoading && messages.at(-1)?.role === "user" && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm h-5 mt-4">
              <span className="inline-block size-3 rounded-full bg-foreground flex-shrink-0 animate-[scale-pulse_1.5s_ease-in-out_infinite]" />
            </div>
          )}
          {/* Standalone error when API fails before an assistant message is created */}
          {error && !isLoading && !isSubmitting && messages.at(-1)?.role === "user" && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm mt-4">
              <HugeiconsIcon icon={Alert02Icon} className="size-5 flex-shrink-0" />
              <span>{getErrorTitle(error)}</span>
            </div>
          )}
          {/* Render unresolved (pending) UI interactions at the bottom */}
          {Array.from(uiInteraction.pendingInteractions.values())
            .filter((interaction) => !interaction.resolved)
            .map((interaction) =>
              interaction.type === "form" ? (
                <FormInteraction
                  key={interaction.id}
                  id={interaction.id}
                  title={interaction.data.title}
                  description={interaction.data.description}
                  fields={interaction.data.fields}
                />
              ) : (
                <ChoiceInteraction
                  key={interaction.id}
                  id={interaction.id}
                  title={interaction.data.title}
                  description={interaction.data.description}
                  options={interaction.data.options}
                  allowMultiple={interaction.data.allowMultiple}
                />
              )
            )}
          {/* Fallback: render resolved interactions at bottom when anchor message not found */}
          {Array.from(uiInteraction.pendingInteractions.values())
            .filter((interaction) => interaction.resolved && interaction.type !== "display")
            .filter((interaction) => {
              const anchorId = interaction.data.afterMessageId;
              if (!anchorId) return true;
              const anchorExists = messages.some((m: any) => m.id === anchorId);
              const toolResultExists = messages.some((m: any) =>
                m.role === "user" && m.parts?.[0]?.type === "text" &&
                m.parts[0].text?.includes("[Tool Execution Results]") &&
                (m.parts[0].text?.includes("prompt_user_choice") || m.parts[0].text?.includes("prompt_user_form"))
              );
              return !anchorExists && !toolResultExists;
            })
            .map((interaction) =>
              interaction.type === "form" ? (
                <FormInteraction
                  key={interaction.id}
                  id={interaction.id}
                  title={interaction.data.title}
                  description={interaction.data.description}
                  fields={interaction.data.fields}
                  resolved={true}
                  result={interaction.result}
                />
              ) : (
                <ChoiceInteraction
                  key={interaction.id}
                  id={interaction.id}
                  title={interaction.data.title}
                  description={interaction.data.description}
                  options={interaction.data.options}
                  allowMultiple={interaction.data.allowMultiple}
                  resolved={true}
                  result={interaction.result}
                />
              )
            )}
          {/* Render display interactions at bottom when anchor message not found */}
          {getUnanchoredDisplays(uiInteraction.pendingInteractions, messages)
            .map((interaction) =>
              interaction.data.displayType === "weather" ? (
                <WeatherCard key={interaction.id} data={interaction.result} />
              ) : interaction.data.displayType === "chart" ? (
                <ChartCard key={interaction.id} data={interaction.result} />
              ) : null
            )}
        </div>
      </div>

      <div
        className={`min-w-0 px-10 pb-4 pt-2 ${messages.length === 0 ? "w-full" : "sticky bottom-0"
          }`}
      >
        <div className="mx-auto w-full min-w-0 max-w-3xl overflow-hidden">
          <PromptInput
            accept="image/*,application/pdf,.xlsx,.xls,.docx,.zip,application/zip"
            globalDrop
            multiple
            onFilesChange={handleFilesChange}
            onSubmit={onSubmit}
          >
            <div
              data-align="block-end"
              className="order-first w-full min-w-0 max-w-full overflow-hidden"
            >
              <PromptInputAttachments>
                {(attachment) => (
                  <PromptInputAttachment
                    key={attachment.id}
                    data={attachment}
                  />
                )}
              </PromptInputAttachments>
            </div>
            <div className="flex w-full min-w-0 items-center gap-1 px-3 py-2">
              <PromptMenu
                selectedModel={selectedModel}
                onSelectModel={handleSelectModel}
                thinkingEnabled={thinkingEnabled}
                onToggleThinking={handleToggleThinking}
              />
              <PromptInputTextarea
                disabled={!authenticated}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isVoiceActive
                    ? "Listening..."
                    : authenticated
                      ? `Ask ${MODELS.find((m) => m.id === selectedModel)?.name ?? "AI"}${thinkingEnabled ? " (thinking)" : ""}`
                      : CHAT_INPUT_PLACEHOLDER_UNAUTHENTICATED
                }
                value={input}
                className="flex-1 px-2"
              />
              {voiceEnabled && (
                isVoiceActive && !voiceChatMode ? (
                  <div className={`flex items-center origin-right ${isVoiceClosing ? "transition-all duration-200 opacity-0 scale-50" : "animate-in fade-in zoom-in-50 duration-200 origin-right"}`}>
                    <button
                      type="button"
                      onClick={handleVoiceToggle}
                      disabled={isVoiceClosing}
                      className="flex items-center gap-1.5 rounded-l-xl bg-black dark:bg-white text-white dark:text-black pl-3 pr-2.5 h-8 text-xs font-medium cursor-pointer"
                      style={{ cornerShape: "squircle" } as React.CSSProperties}
                    >
                      <div className="flex items-center gap-0.5 h-4">
                        {[0.6, 1, 0.6].map((scale, i) => (
                          <div
                            key={i}
                            className="w-0.5 rounded-full bg-current transition-all duration-100"
                            style={{ height: `${Math.max(4, voiceLevel * scale * 16)}px` }}
                          />
                        ))}
                      </div>
                      Stop
                    </button>
                    <button
                      type="button"
                      onClick={handleVoiceChat}
                      disabled={isVoiceClosing}
                      className="flex items-center gap-1.5 rounded-r-xl bg-black dark:bg-white text-white dark:text-black pl-2.5 pr-3 h-8 text-xs font-medium cursor-pointer ml-[2px]"
                      style={{ cornerShape: "squircle" } as React.CSSProperties}
                    >
                      <AudioLinesIcon className="size-3.5" />
                      Chat
                    </button>
                  </div>
                ) : isVoiceActive && voiceChatMode ? (
                  <button
                    type="button"
                    onClick={handleVoiceChatToggle}
                    disabled={isVoiceClosing}
                    className={`flex items-center gap-1.5 rounded-xl bg-black dark:bg-white text-white dark:text-black px-3 h-8 text-xs font-medium cursor-pointer origin-right ${isVoiceClosing ? "transition-all duration-200 opacity-0 scale-50" : "animate-in fade-in zoom-in-50 duration-200 origin-right"}`}
                    style={{ cornerShape: "squircle" } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-0.5 h-4">
                      {[0.6, 1, 0.6].map((scale, i) => (
                        <div
                          key={i}
                          className="w-0.5 rounded-full bg-current transition-all duration-100"
                          style={{ height: `${Math.max(4, voiceLevel * scale * 16)}px` }}
                        />
                      ))}
                    </div>
                    Stop
                  </button>
                ) : voiceChatMode ? (
                  <button
                    type="button"
                    onClick={handleVoiceChatToggle}
                    className="flex items-center gap-1.5 rounded-xl bg-black dark:bg-white text-white dark:text-black px-3 h-8 text-xs font-medium cursor-pointer origin-right animate-in fade-in zoom-in-50 duration-200 origin-right"
                    style={{ cornerShape: "squircle" } as React.CSSProperties}
                  >
                    <div className="flex items-center gap-0.5 h-4 animate-pulse">
                      {[0.6, 1, 0.6].map((scale, i) => (
                        <div
                          key={i}
                          className="w-0.5 rounded-full bg-current"
                          style={{ height: `${4 * scale}px` }}
                        />
                      ))}
                    </div>
                    Stop
                  </button>
                ) : (
                  <PromptInputButton
                    onClick={handleVoiceToggle}
                    disabled={isLoading || !authenticated}
                    className="animate-in fade-in zoom-in-50 duration-200"
                  >
                    <AudioLinesIcon className="size-5" />
                  </PromptInputButton>
                )
              )}
              {!isVoiceActive && !voiceChatMode && (
                isLoading ? (
                  <button
                    type="button"
                    onClick={() => stop()}
                    aria-label="Stop generating"
                    className="inline-flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <SquareIcon className="size-3" fill="currentColor" strokeWidth={0} />
                  </button>
                ) : (
                  <PromptInputSubmit
                    disabled={!input || !authenticated || voiceChatMode}
                  />
                )
              )}
            </div>
          </PromptInput>
        </div>
      </div>
    </div>
  );
};

export default ChatBotDemo;
