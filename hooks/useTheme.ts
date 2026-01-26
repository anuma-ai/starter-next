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
}

export function useTheme() {
  const [currentThemeId, setCurrentThemeId] = useState<string>(getStoredThemeId);

  // Apply stored theme on mount
  useEffect(() => {
    const storedId = getStoredThemeId();
    setCurrentThemeId(storedId);
    applyTheme(storedId);
  }, []);

  const setTheme = useCallback((preset: ThemePreset) => {
    setCurrentThemeId(preset.id);
    applyTheme(preset.id);
    localStorage.setItem(THEME_STORAGE_KEY, preset.id);
  }, []);

  return {
    currentTheme: getThemeById(currentThemeId),
    currentThemeId,
    setTheme,
    presets: THEME_PRESETS,
  };
}
