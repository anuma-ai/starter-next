export type ThemePreset = {
  id: string;
  name: string;
  background: string;
  isDark: boolean;
};

export const THEME_PRESETS: ThemePreset[] = [
  { id: "light", name: "Light", background: "#ffffff", isDark: false },
  { id: "dark", name: "Dark", background: "#3d3d3d", isDark: true },
  { id: "orange", name: "Orange", background: "#c57742", isDark: true },
  { id: "green", name: "Green", background: "#2e6f40", isDark: true },
  { id: "blue", name: "Blue", background: "#000080", isDark: true },
];

export const DEFAULT_THEME = THEME_PRESETS[0];
export const THEME_STORAGE_KEY = "app_theme";

export function getThemeById(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) || DEFAULT_THEME;
}
