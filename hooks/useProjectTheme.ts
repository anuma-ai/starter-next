"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type ProjectThemeSettings,
  getProjectTheme,
  setProjectTheme,
  getProjectThemeStorageKey,
} from "@/lib/project-theme";

/**
 * React hook for managing project-level theme settings
 *
 * @param projectId - The project ID to manage themes for (null if no project)
 * @returns Theme settings and update functions
 */
export function useProjectTheme(projectId: string | null) {
  const [settings, setSettings] = useState<ProjectThemeSettings>({});

  // Load initial settings and listen for changes
  useEffect(() => {
    if (!projectId) {
      setSettings({});
      return;
    }

    // Load initial settings
    setSettings(getProjectTheme(projectId));

    // Listen for storage changes (from other tabs or components)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === getProjectThemeStorageKey(projectId)) {
        setSettings(e.newValue ? JSON.parse(e.newValue) : {});
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [projectId]);

  /**
   * Update the color theme for this project
   * @param colorTheme - Theme ID or undefined to inherit from global
   */
  const updateColorTheme = useCallback(
    (colorTheme: string | undefined) => {
      if (!projectId) return;

      const newSettings = { ...settings, colorTheme };
      // Clean up undefined values
      if (colorTheme === undefined) {
        delete newSettings.colorTheme;
      }
      setSettings(newSettings);
      setProjectTheme(projectId, newSettings);
    },
    [projectId, settings]
  );

  /**
   * Update the icon theme (background pattern) for this project
   * @param iconTheme - Icon theme ID or undefined to inherit from global
   */
  const updateIconTheme = useCallback(
    (iconTheme: string | undefined) => {
      if (!projectId) return;

      const newSettings = { ...settings, iconTheme };
      // Clean up undefined values
      if (iconTheme === undefined) {
        delete newSettings.iconTheme;
      }
      setSettings(newSettings);
      setProjectTheme(projectId, newSettings);
    },
    [projectId, settings]
  );

  /**
   * Clear all theme overrides for this project
   */
  const clearTheme = useCallback(() => {
    if (!projectId) return;

    setSettings({});
    setProjectTheme(projectId, {});
  }, [projectId]);

  return {
    settings,
    updateColorTheme,
    updateIconTheme,
    clearTheme,
    hasColorOverride: settings.colorTheme !== undefined,
    hasIconOverride: settings.iconTheme !== undefined,
  };
}
