"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, CheckIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ThemePicker } from "@/app/components/theme-picker";
import { useIconTheme, useChatPattern, ICON_THEMES, type IconThemeId } from "@/lib/chat-pattern";
import { cn } from "@/lib/utils";

export default function AppearancePage() {
  const router = useRouter();
  const { iconTheme, setIconTheme } = useIconTheme();
  const patternStyle = useChatPattern();

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
              <div className="flex flex-wrap gap-2">
                {(Object.entries(ICON_THEMES) as [IconThemeId, typeof ICON_THEMES[IconThemeId]][]).map(
                  ([id, theme]) => {
                    const isSelected = iconTheme === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setIconTheme(id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm transition-all",
                          "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                          isSelected
                            ? "bg-foreground text-background"
                            : "bg-muted/50 text-foreground"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          {isSelected && <CheckIcon className="size-3" />}
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
