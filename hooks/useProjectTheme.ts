"use client";

import { useEffect, useCallback, useRef, useReducer } from "react";
import {
  type ProjectThemeSettings,
  getProjectTheme,
  setProjectTheme,
  getProjectThemeStorageKey,
} from "@/lib/project-theme";

/**
 * React hook for managing project-level theme settings
 * Uses synchronous reads during render to prevent flash of wrong theme
 *
 * @param projectId - The project ID to manage themes for (null if no project)
 * @returns Theme settings and update functions
 */
export function useProjectTheme(projectId: string | null) {
  // Use ref to track which projectId we've loaded settings for
  const loadedProjectIdRef = useRef<string | null>(null);
  const settingsRef = useRef<ProjectThemeSettings>({});

  // Synchronously update settings when projectId changes (during render phase)
  // This ensures settings are available on the FIRST render, not after an effect
  if (projectId !== loadedProjectIdRef.current) {
    loadedProjectIdRef.current = projectId;
    settingsRef.current = projectId ? getProjectTheme(projectId) : {};
  }

  // Use reducer to force re-renders when settings change from external sources
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Settings are always loaded synchronously now
  const settingsLoaded = true;

  // Listen for storage changes (from other tabs or components)
  useEffect(() => {
    if (!projectId) return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === getProjectThemeStorageKey(projectId)) {
        settingsRef.current = e.newValue ? JSON.parse(e.newValue) : {};
        forceUpdate();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [projectId]);

  // Get current settings from ref
  const settings = settingsRef.current;

  /**
   * Update the color theme for this project
   * @param colorTheme - Theme ID or undefined to inherit from global
   */
  const updateColorTheme = useCallback(
    (colorTheme: string | undefined) => {
      if (!projectId) return;

      const newSettings = { ...settingsRef.current, colorTheme };
      // Clean up undefined values
      if (colorTheme === undefined) {
        delete newSettings.colorTheme;
      }
      settingsRef.current = newSettings;
      setProjectTheme(projectId, newSettings);
      forceUpdate();
    },
    [projectId]
  );

  /**
   * Update the icon theme (background pattern) for this project
   * @param iconTheme - Icon theme ID or undefined to inherit from global
   */
  const updateIconTheme = useCallback(
    (iconTheme: string | undefined) => {
      if (!projectId) return;

      const newSettings = { ...settingsRef.current, iconTheme };
      // Clean up undefined values
      if (iconTheme === undefined) {
        delete newSettings.iconTheme;
      }
      settingsRef.current = newSettings;
      setProjectTheme(projectId, newSettings);
      forceUpdate();
    },
    [projectId]
  );

  /**
   * Update the project icon (openmoji hexcode)
   * @param projectIcon - Openmoji hexcode or undefined to remove
   */
  const updateProjectIcon = useCallback(
    (projectIcon: string | undefined) => {
      if (!projectId) return;

      const newSettings = { ...settingsRef.current, projectIcon };
      // Clean up undefined values
      if (projectIcon === undefined) {
        delete newSettings.projectIcon;
      }
      settingsRef.current = newSettings;
      setProjectTheme(projectId, newSettings);
      forceUpdate();
    },
    [projectId]
  );

  /**
   * Clear all theme overrides for this project
   */
  const clearTheme = useCallback(() => {
    if (!projectId) return;

    settingsRef.current = {};
    setProjectTheme(projectId, {});
    forceUpdate();
  }, [projectId]);

  return {
    settings,
    settingsLoaded,
    loadedForProjectId: loadedProjectIdRef.current,
    updateColorTheme,
    updateIconTheme,
    updateProjectIcon,
    clearTheme,
    hasColorOverride: settings.colorTheme !== undefined,
    hasIconOverride: settings.iconTheme !== undefined,
    hasProjectIcon: settings.projectIcon !== undefined,
  };
}
