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
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  // Track which projectId the settings were loaded for
  // This prevents using stale settings during projectId transitions
  const [loadedForProjectId, setLoadedForProjectId] = useState<string | null>(null);

  // Load initial settings and listen for changes
  useEffect(() => {
    // Reset loaded state when projectId changes
    setSettingsLoaded(false);
    setLoadedForProjectId(null);

    if (!projectId) {
      setSettings({});
      setSettingsLoaded(true);
      setLoadedForProjectId(null);
      return;
    }

    // Load initial settings from localStorage
    setSettings(getProjectTheme(projectId));
    setSettingsLoaded(true);
    setLoadedForProjectId(projectId);

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
   * Update the project icon (openmoji hexcode)
   * @param projectIcon - Openmoji hexcode or undefined to remove
   */
  const updateProjectIcon = useCallback(
    (projectIcon: string | undefined) => {
      if (!projectId) return;

      const newSettings = { ...settings, projectIcon };
      // Clean up undefined values
      if (projectIcon === undefined) {
        delete newSettings.projectIcon;
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
    settingsLoaded,
    loadedForProjectId,
    updateColorTheme,
    updateIconTheme,
    updateProjectIcon,
    clearTheme,
    hasColorOverride: settings.colorTheme !== undefined,
    hasIconOverride: settings.iconTheme !== undefined,
    hasProjectIcon: settings.projectIcon !== undefined,
  };
}
