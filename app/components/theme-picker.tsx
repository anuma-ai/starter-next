"use client";

import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

export function ThemePicker() {
  const { currentThemeId, setTheme, presets } = useTheme();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {presets.map((preset) => {
          const isSelected = currentThemeId === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => setTheme(preset)}
              className={cn(
                "relative h-10 w-10 rounded-full border-2 transition-all cursor-pointer",
                "hover:scale-110 focus:outline-none",
                isSelected ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: preset.background }}
              title={preset.name}
            >
              {isSelected && (
                <CheckIcon
                  className={cn(
                    "absolute inset-0 m-auto size-4",
                    preset.isDark ? "text-white" : "text-gray-800"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">
        {presets.find((p) => p.id === currentThemeId)?.name || "Custom"}
      </p>
    </div>
  );
}
