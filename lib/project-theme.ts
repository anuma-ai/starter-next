// Project-level theme settings storage
// Allows projects to override global color theme and background icon theme

export type ProjectThemeSettings = {
  colorTheme?: string; // undefined = inherit from global settings
  iconTheme?: string; // undefined = inherit from global settings
  projectIcon?: string; // openmoji hexcode for the project icon
};

// Storage key pattern for project themes
const PROJECT_THEME_STORAGE_KEY = (projectId: string) =>
  `project_theme_${projectId}`;

/**
 * Get theme settings for a project from localStorage
 */
export function getProjectTheme(projectId: string): ProjectThemeSettings {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(PROJECT_THEME_STORAGE_KEY(projectId));
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save theme settings for a project to localStorage
 */
export function setProjectTheme(
  projectId: string,
  settings: ProjectThemeSettings
): void {
  if (typeof window === "undefined") return;

  // Remove keys with undefined values for cleaner storage
  const cleanSettings: ProjectThemeSettings = {};
  if (settings.colorTheme !== undefined) {
    cleanSettings.colorTheme = settings.colorTheme;
  }
  if (settings.iconTheme !== undefined) {
    cleanSettings.iconTheme = settings.iconTheme;
  }
  if (settings.projectIcon !== undefined) {
    cleanSettings.projectIcon = settings.projectIcon;
  }

  // If both are undefined, remove the storage entry entirely
  if (Object.keys(cleanSettings).length === 0) {
    localStorage.removeItem(PROJECT_THEME_STORAGE_KEY(projectId));
  } else {
    localStorage.setItem(
      PROJECT_THEME_STORAGE_KEY(projectId),
      JSON.stringify(cleanSettings)
    );
  }

  // Dispatch storage event for cross-component updates
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: PROJECT_THEME_STORAGE_KEY(projectId),
      newValue:
        Object.keys(cleanSettings).length > 0
          ? JSON.stringify(cleanSettings)
          : null,
    })
  );
}

/**
 * Clear all theme settings for a project
 */
export function clearProjectTheme(projectId: string): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(PROJECT_THEME_STORAGE_KEY(projectId));

  window.dispatchEvent(
    new StorageEvent("storage", {
      key: PROJECT_THEME_STORAGE_KEY(projectId),
      newValue: null,
    })
  );
}

/**
 * Get the storage key for a project (useful for listening to changes)
 */
export function getProjectThemeStorageKey(projectId: string): string {
  return PROJECT_THEME_STORAGE_KEY(projectId);
}
