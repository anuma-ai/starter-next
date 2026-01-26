"use client";

import {
  useProjects,
  type StoredProject,
  type StoredConversation,
  type CreateProjectOptions,
  type UpdateProjectOptions,
} from "@reverbia/sdk/react";
import { useDatabase } from "@/app/providers";

/**
 * useAppProjects Hook
 *
 * A wrapper around the SDK's useProjects hook that automatically
 * provides the database from the app's context.
 *
 * Projects allow users to organize their conversations by topic,
 * purpose, or any other criteria.
 */
export function useAppProjects() {
  const database = useDatabase();

  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    isLoading,
    isReady,
    createProject,
    getProject,
    getProjects,
    updateProjectName,
    updateProject,
    deleteProject,
    getProjectConversations,
    getProjectConversationCount,
    updateConversationProject,
    getConversationsByProject,
    refreshProjects,
    inboxProjectId,
  } = useProjects({ database });

  return {
    // State
    projects,
    currentProjectId,
    setCurrentProjectId,
    isLoading,
    isReady,
    inboxProjectId,

    // Project CRUD
    createProject,
    getProject,
    getProjects,
    updateProjectName,
    updateProject,
    deleteProject,

    // Conversation management
    getProjectConversations,
    getProjectConversationCount,
    updateConversationProject,
    getConversationsByProject,

    // Utilities
    refreshProjects,
  };
}

// Re-export types for convenience
export type {
  StoredProject as Project,
  StoredConversation as ProjectConversation,
  CreateProjectOptions,
  UpdateProjectOptions,
};
