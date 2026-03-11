"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CaretLeft } from "@phosphor-icons/react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useVoice } from "@anuma/sdk/react";

export default function VoicePage() {
  const router = useRouter();
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const { preloadModel, isModelLoaded, isLoadingModel } = useVoice({
    onModelProgress: (p) => {
      setDownloadProgress(Math.round(p.progress * 100));
    },
  });

  useEffect(() => {
    const saved = localStorage.getItem("voice_enabled");
    if (saved === "true") setVoiceEnabled(true);
  }, []);

  const handleToggle = useCallback(
    async (checked: boolean) => {
      setVoiceEnabled(checked);
      localStorage.setItem("voice_enabled", checked.toString());
      if (checked) {
        setDownloadProgress(0);
        await preloadModel();
        setDownloadProgress(null);
      }
    },
    [preloadModel]
  );

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
            <CaretLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold w-full text-center">Voice</h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-card p-1">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="voiceEnabled" className="text-base">
                    Enable voice input
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Record and transcribe voice messages on-device
                  </p>
                </div>
                <Switch
                  id="voiceEnabled"
                  checked={voiceEnabled}
                  onCheckedChange={handleToggle}
                  disabled={isLoadingModel}
                />
              </div>
            </div>

            {isLoadingModel && downloadProgress !== null && (
              <div className="px-4 py-3 border-t border-border">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Downloading speech recognition model...
                    </span>
                    <span className="text-muted-foreground">
                      {downloadProgress}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {voiceEnabled && isModelLoaded && !isLoadingModel && (
              <div className="px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Model ready. A microphone button will appear in the chat
                  input.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white dark:bg-card p-4">
            <h3 className="text-sm font-medium mb-2">How voice input works</h3>
            <p className="text-sm text-muted-foreground">
              Voice input uses a Whisper speech recognition model that runs
              entirely in your browser. The model (~40 MB) is downloaded once
              and cached. No audio is sent to any server — all transcription
              happens on your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
