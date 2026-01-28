"use client";

import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { nanoid } from "nanoid";
import type { StoredApp, CreateAppOptions } from "@/types/app";

const APPS_STORAGE_KEY = "vibe_apps";

/**
 * Get all apps from localStorage
 */
function getStoredApps(): StoredApp[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(APPS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save apps to localStorage
 */
function setStoredApps(apps: StoredApp[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(apps));
  } catch (error) {
    console.error("[useApps] Failed to save apps:", error);
  }
}

/**
 * React hook for managing apps with localStorage persistence.
 * Apps are "vibe coding" projects where users build apps via AI prompts.
 *
 * @param createConversation - Function to create a new conversation (from SDK)
 * @param deleteConversation - Function to delete a conversation (from SDK)
 * @returns Apps state and CRUD functions
 */
export function useApps(
  createConversation: (opts?: { createImmediately?: boolean }) => Promise<{ conversationId: string } | null>,
  deleteConversation?: (conversationId: string) => Promise<void>
) {
  const [apps, setApps] = useState<StoredApp[]>([]);
  const [isReady, setIsReady] = useState(false);
  const loadedRef = useRef(false);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Load apps on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const storedApps = getStoredApps();
    setApps(storedApps);
    setIsReady(true);
  }, []);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === APPS_STORAGE_KEY) {
        const newApps = e.newValue ? JSON.parse(e.newValue) : [];
        setApps(newApps);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Listen for AI-generated title updates and auto-update app names
  useEffect(() => {
    const handleTitleUpdate = (e: Event) => {
      const { conversationId, title: newTitle } = (e as CustomEvent).detail;
      if (!conversationId || !newTitle) return;

      // Check if this conversation belongs to an app
      setApps((currentApps) => {
        const appIndex = currentApps.findIndex((a) => a.conversationId === conversationId);
        if (appIndex === -1) return currentApps;

        // Only update if the app doesn't have a name yet
        const app = currentApps[appIndex];
        if (app.name && app.name.trim() !== "") return currentApps;

        const updatedApp: StoredApp = {
          ...app,
          name: newTitle,
          updatedAt: Date.now(),
        };

        const updatedApps = [...currentApps];
        updatedApps[appIndex] = updatedApp;
        setStoredApps(updatedApps);

        return updatedApps;
      });
    };

    window.addEventListener("conversation-title-updated", handleTitleUpdate);
    return () => window.removeEventListener("conversation-title-updated", handleTitleUpdate);
  }, []);

  /**
   * Create a new app with an associated conversation
   */
  const createApp = useCallback(
    async (options?: CreateAppOptions): Promise<StoredApp | null> => {
      // Create a conversation for this app's chat history
      // Must pass createImmediately: true to force immediate creation
      const conversation = await createConversation({ createImmediately: true });
      if (!conversation?.conversationId) {
        console.error("[useApps] Failed to create conversation for app");
        return null;
      }

      const now = Date.now();
      const newApp: StoredApp = {
        appId: nanoid(),
        name: options?.name || "",
        description: options?.description,
        conversationId: conversation.conversationId,
        createdAt: now,
        updatedAt: now,
        icon: options?.icon,
      };

      const updatedApps = [newApp, ...apps];
      setApps(updatedApps);
      setStoredApps(updatedApps);

      return newApp;
    },
    [apps, createConversation]
  );

  /**
   * Update an existing app
   */
  const updateApp = useCallback(
    async (
      appId: string,
      updates: Partial<Omit<StoredApp, "appId" | "conversationId" | "createdAt">>
    ): Promise<StoredApp | null> => {
      const appIndex = apps.findIndex((a) => a.appId === appId);
      if (appIndex === -1) {
        console.error("[useApps] App not found:", appId);
        return null;
      }

      const updatedApp: StoredApp = {
        ...apps[appIndex],
        ...updates,
        updatedAt: Date.now(),
      };

      const updatedApps = [...apps];
      updatedApps[appIndex] = updatedApp;

      setApps(updatedApps);
      setStoredApps(updatedApps);

      return updatedApp;
    },
    [apps]
  );

  /**
   * Update app name
   */
  const updateAppName = useCallback(
    async (appId: string, name: string): Promise<boolean> => {
      const result = await updateApp(appId, { name });
      return result !== null;
    },
    [updateApp]
  );

  /**
   * Delete an app, its files, and its associated conversation
   */
  const deleteApp = useCallback(
    async (appId: string): Promise<boolean> => {
      const appIndex = apps.findIndex((a) => a.appId === appId);
      if (appIndex === -1) {
        console.error("[useApps] App not found:", appId);
        return false;
      }

      const app = apps[appIndex];

      // Delete app files from localStorage
      try {
        localStorage.removeItem(`vibe_app_files_${appId}`);
      } catch {
        // Ignore errors
      }

      // Delete the associated conversation
      if (app.conversationId && deleteConversation) {
        try {
          await deleteConversation(app.conversationId);
        } catch (error) {
          console.error("[useApps] Failed to delete conversation:", error);
          // Continue with app deletion even if conversation deletion fails
        }
      }

      const updatedApps = apps.filter((a) => a.appId !== appId);
      setApps(updatedApps);
      setStoredApps(updatedApps);

      return true;
    },
    [apps, deleteConversation]
  );

  /**
   * Get a specific app by ID
   */
  const getApp = useCallback(
    (appId: string): StoredApp | null => {
      return apps.find((a) => a.appId === appId) || null;
    },
    [apps]
  );

  /**
   * Refresh apps from localStorage
   */
  const refreshApps = useCallback(() => {
    const storedApps = getStoredApps();
    setApps(storedApps);
    forceUpdate();
  }, []);

  return {
    apps,
    isReady,
    createApp,
    updateApp,
    updateAppName,
    deleteApp,
    getApp,
    refreshApps,
  };
}
