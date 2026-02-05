"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ThemePicker } from "@/app/components/theme-picker";
import { useIconTheme, useChatPattern, getPreviewIcons, getPatternStrokeColor, ICON_THEMES, IconThemeId } from "@/lib/chat-pattern";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

// Hook to load preview icons for all themes
function usePreviewIcons(strokeColor: string) {
  const [previewIcons, setPreviewIcons] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const loadIcons = async () => {
      const entries = Object.keys(ICON_THEMES) as IconThemeId[];
      const results: Record<string, string[]> = {};

      await Promise.all(
        entries.map(async (id) => {
          const icons = await getPreviewIcons(id, strokeColor);
          results[id] = icons;
        })
      );

      setPreviewIcons(results);
    };

    loadIcons();
  }, [strokeColor]);

  return previewIcons;
}

export default function AppearancePage() {
  const router = useRouter();
  const { iconTheme, setIconTheme } = useIconTheme();
  const { currentThemeId } = useTheme();
  const patternStyle = useChatPattern();

  // Get the stroke color for pattern previews based on current theme
  const previewStrokeColor = getPatternStrokeColor(currentThemeId);
  const previewIconsMap = usePreviewIcons(previewStrokeColor);

  return (
    <div
      className="flex flex-1 flex-col p-8 pt-16 md:pt-8 bg-background border-l border-border dark:border-l-0"
      style={patternStyle}
    >
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
          <h1 className="text-lg font-semibold w-full text-center">
            Appearance
          </h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white dark:bg-card p-1 border border-border dark:border-transparent">
            <div className="px-4 py-3">
              <div className="space-y-0.5 mb-3">
                <Label className="text-base">Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose a color theme for the app
                </p>
              </div>
              <ThemePicker />
            </div>
            <div className="px-4 py-3 border-t border-border">
              <div className="space-y-0.5 mb-3">
                <Label className="text-base">Background</Label>
                <p className="text-sm text-muted-foreground">
                  Choose a background pattern for chats
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {/* None option */}
                <button
                  onClick={() => setIconTheme("none")}
                  className="group relative flex flex-col items-center gap-1.5 p-1 rounded-lg focus:outline-none cursor-pointer"
                >
                  <div className="w-full aspect-[4/3] rounded-md bg-background border border-gray-200 dark:border-transparent relative flex items-center justify-center">
                    <span className="text-muted-foreground text-xs">No pattern</span>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full transition-colors",
                      iconTheme === "none"
                        ? "bg-foreground text-background"
                        : "group-hover:ring-1"
                    )}
                    style={iconTheme !== "none" ? { '--tw-ring-color': previewStrokeColor } as React.CSSProperties : undefined}
                  >
                    None
                  </span>
                </button>
                {(Object.entries(ICON_THEMES) as [keyof typeof ICON_THEMES, (typeof ICON_THEMES)[keyof typeof ICON_THEMES]][]).map(
                  ([id, theme]) => {
                    const isSelected = iconTheme === id;
                    const previewIcons = previewIconsMap[id] || [];
                    return (
                      <button
                        key={id}
                        onClick={() => setIconTheme(id)}
                        className="group relative flex flex-col items-center gap-1.5 p-1 rounded-lg focus:outline-none cursor-pointer"
                      >
                        <div className="w-full aspect-[4/3] rounded-md bg-background border border-gray-200 dark:border-transparent relative flex items-center justify-center">
                          {previewIcons.length >= 3 && (
                            <>
                              <img
                                src={previewIcons[0]}
                                alt=""
                                className="absolute top-3 left-1/2 -translate-x-1/2 size-10"
                              />
                              <img
                                src={previewIcons[1]}
                                alt=""
                                className="absolute bottom-3 left-1/3 -translate-x-1/2 size-10"
                              />
                              <img
                                src={previewIcons[2]}
                                alt=""
                                className="absolute bottom-3 right-1/3 translate-x-1/2 size-10"
                              />
                            </>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full transition-colors",
                            isSelected
                              ? "bg-foreground text-background"
                              : "group-hover:ring-1"
                          )}
                          style={!isSelected ? { '--tw-ring-color': previewStrokeColor } as React.CSSProperties : undefined}
                        >
                          {theme.name}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
