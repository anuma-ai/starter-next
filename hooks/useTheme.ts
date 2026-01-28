"use client";

import { useCallback, useState, useEffect } from "react";
import {
  THEME_PRESETS,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  getThemeById,
  type ThemePreset,
} from "@/lib/theme-colors";

export function getStoredThemeId(): string {
  if (typeof window === "undefined") {
    return DEFAULT_THEME.id;
  }
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEME_PRESETS.some((t) => t.id === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_THEME.id;
}

export function applyTheme(themeId: string): void {
  const root = document.documentElement;

  // Remove all theme classes
  THEME_PRESETS.forEach((preset) => {
    root.classList.remove(`theme-${preset.id}`);
  });

  // Add the new theme class (light theme has no class)
  if (themeId !== "light") {
    root.classList.add(`theme-${themeId}`);
  }

  // Force reflow to ensure CSS variables are applied before navigation
  // Reading offsetHeight triggers synchronous style recalculation
  void root.offsetHeight;
}

export function useTheme() {
  const [currentThemeId, setCurrentThemeId] = useState<string>(getStoredThemeId);

  // Apply stored theme on mount
  useEffect(() => {
    const storedId = getStoredThemeId();
    setCurrentThemeId(storedId);
    applyTheme(storedId);
  }, []);

  // Listen for theme changes from other components/tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        if (THEME_PRESETS.some((t) => t.id === e.newValue)) {
          setCurrentThemeId(e.newValue);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback((preset: ThemePreset) => {
    setCurrentThemeId(preset.id);
    applyTheme(preset.id);
    localStorage.setItem(THEME_STORAGE_KEY, preset.id);
    // Dispatch storage event for same-tab listeners
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: preset.id,
      })
    );
  }, []);

  return {
    currentTheme: getThemeById(currentThemeId),
    currentThemeId,
    setTheme,
    presets: THEME_PRESETS,
  };
}
