// Chat doodle pattern generator using OpenMoji icons
// Icons are dynamically imported from the openmoji npm package
// License: CC BY-SA 4.0 - https://openmoji.org/

import * as React from "react";

// Import openmoji metadata for dynamic icon selection
import openmojiData from "openmoji/data/openmoji.json";

// Define available icon themes based on openmoji groups
export const ICON_THEMES = {
  nature: {
    name: "Nature",
    group: "animals-nature",
    description: "Plants, flowers, and weather",
  },
  animals: {
    name: "Animals",
    group: "animals-nature",
    description: "Cute animal faces and creatures",
  },
  travel: {
    name: "Travel",
    group: "travel-places",
    description: "Places, vehicles, and landmarks",
  },
  food: {
    name: "Food",
    group: "food-drink",
    description: "Food, drinks, and cooking",
  },
  activities: {
    name: "Activities",
    group: "activities",
    description: "Sports, games, and hobbies",
  },
  objects: {
    name: "Objects",
    group: "objects",
    description: "Everyday items and tools",
  },
  symbols: {
    name: "Symbols",
    group: "symbols",
    description: "Hearts, stars, and shapes",
  },
} as const;

export type IconThemeId = keyof typeof ICON_THEMES;

// Filter metadata to get valid hexcodes (simple codes without modifiers)
function getIconsForTheme(themeId: IconThemeId, limit: number = 15): string[] {
  const theme = ICON_THEMES[themeId];

  // Filter icons by group, excluding compound emojis (with dashes) and skin tone variants
  const icons = (openmojiData as Array<{
    hexcode: string;
    group: string;
    skintone: string;
  }>)
    .filter(
      (emoji) =>
        emoji.group === theme.group &&
        !emoji.hexcode.includes("-") && // Skip compound emojis
        !emoji.skintone // Skip skin tone variants
    )
    .map((emoji) => emoji.hexcode);

  // Return a subset, selecting evenly distributed icons
  const step = Math.max(1, Math.floor(icons.length / limit));
  const selected: string[] = [];
  for (let i = 0; i < icons.length && selected.length < limit; i += step) {
    selected.push(icons[i]);
  }
  return selected;
}

// Dynamically import SVG files using webpack's require.context
// This creates a bundle with all black SVGs at build time
const svgContext = require.context(
  "openmoji/black/svg",
  false,
  /^\.\/[A-F0-9]+\.svg$/
);

// Cache for loaded SVG content
const svgCache = new Map<string, string>();

// Load an SVG by hexcode
function loadSvg(hexcode: string): string | null {
  if (svgCache.has(hexcode)) {
    return svgCache.get(hexcode)!;
  }

  try {
    const svgContent = svgContext(`./${hexcode}.svg`) as string;
    const extracted = extractSvgContent(svgContent);
    svgCache.set(hexcode, extracted);
    return extracted;
  } catch {
    return null;
  }
}

// Extract the inner content from an SVG string (content inside the <g id="line"> tag)
function extractSvgContent(svgString: string): string {
  // Find the <g id="line"> group which contains the outline paths
  const lineMatch = svgString.match(/<g id="line"[^>]*>([\s\S]*?)<\/g>/);
  if (lineMatch) {
    return normalizeColors(lineMatch[1]);
  }

  // Fallback: extract all path/polygon/circle/line elements
  const elements = svgString.match(
    /<(path|polygon|circle|ellipse|line|polyline|rect)[^>]*\/?>/g
  );
  if (elements) {
    return normalizeColors(elements.join("\n"));
  }

  return "";
}

// Normalize colors: replace black strokes/fills with currentColor
function normalizeColors(svg: string): string {
  return (
    svg
      // Replace black strokes with currentColor
      .replace(/stroke="#000000"/g, 'stroke="currentColor"')
      .replace(/stroke="#000"/g, 'stroke="currentColor"')
      .replace(/stroke="black"/g, 'stroke="currentColor"')
      // Replace black fills with currentColor
      .replace(/fill="#000000"/g, 'fill="currentColor"')
      .replace(/fill="#000"/g, 'fill="currentColor"')
      .replace(/fill="black"/g, 'fill="currentColor"')
      // Add fill="currentColor" to elements that have no fill attribute (they default to black)
      // Match circle, ellipse, rect, polygon that don't have fill= attribute
      // Use [^/>]* to avoid capturing the closing slash
      .replace(
        /<(circle|ellipse|rect|polygon)(\s+)(?![^>]*fill=)([^/>]*)\/?>/g,
        '<$1$2fill="currentColor" $3/>'
      )
  );
}

// Get pattern icons for a theme
function getPatternIcons(themeId: IconThemeId): Array<{ name: string; svg: string }> {
  const hexcodes = getIconsForTheme(themeId);
  const icons: Array<{ name: string; svg: string }> = [];

  for (const hexcode of hexcodes) {
    const svg = loadSvg(hexcode);
    if (svg) {
      icons.push({ name: hexcode, svg });
    }
  }

  return icons;
}

// Seeded random number generator for consistent patterns
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate a single icon SVG element with position and rotation
function generateIconElement(
  svg: string,
  x: number,
  y: number,
  size: number,
  rotation: number
): string {
  return `<g transform="translate(${x}, ${y}) rotate(${rotation}, ${size / 2}, ${size / 2}) scale(${size / 72})">
    ${svg}
  </g>`;
}

// Generate the complete pattern tile SVG with seamless wrapping
export function generateChatPatternSVG(
  strokeColor: string,
  iconTheme: IconThemeId = "nature",
  tileSize: number = 500,
  seed: number = 42
): string {
  const patternIcons = getPatternIcons(iconTheme);
  if (patternIcons.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}"><rect width="100%" height="100%" fill="transparent"/></svg>`;
  }

  const icons: string[] = [];
  const positions: { x: number; y: number; size: number }[] = [];

  // Icon size range for variety
  const minIconSize = 30;
  const maxIconSize = 50;
  const avgIconSize = (minIconSize + maxIconSize) / 2;

  // Use scattered placement
  const numIcons = Math.floor(
    (tileSize * tileSize) / (avgIconSize * avgIconSize * 4)
  );

  // Helper to check overlap with wrapping
  const checkOverlap = (x: number, y: number, minDist: number) => {
    for (const pos of positions) {
      const dx = Math.min(Math.abs(pos.x - x), tileSize - Math.abs(pos.x - x));
      const dy = Math.min(Math.abs(pos.y - y), tileSize - Math.abs(pos.y - y));
      if (Math.hypot(dx, dy) < minDist) return true;
    }
    return false;
  };

  for (let i = 0; i < numIcons * 3; i++) {
    if (positions.length >= numIcons) break;

    const seedVal = seed + i * 7;
    const x = seededRandom(seedVal) * tileSize;
    const y = seededRandom(seedVal + 1000) * tileSize;
    const rotation = (seededRandom(seedVal + 2000) - 0.5) * 40;
    const iconSize =
      minIconSize + seededRandom(seedVal + 3000) * (maxIconSize - minIconSize);

    const minDistance = avgIconSize * 1.4;
    if (!checkOverlap(x, y, minDistance)) {
      positions.push({ x, y, size: iconSize });
      const icon = patternIcons[i % patternIcons.length];
      const drawX = x - iconSize / 2;
      const drawY = y - iconSize / 2;

      // Main position
      icons.push(generateIconElement(icon.svg, drawX, drawY, iconSize, rotation));

      // Wrap horizontally if near edge
      if (x < iconSize) {
        icons.push(generateIconElement(icon.svg, drawX + tileSize, drawY, iconSize, rotation));
      } else if (x > tileSize - iconSize) {
        icons.push(generateIconElement(icon.svg, drawX - tileSize, drawY, iconSize, rotation));
      }

      // Wrap vertically if near edge
      if (y < iconSize) {
        icons.push(generateIconElement(icon.svg, drawX, drawY + tileSize, iconSize, rotation));
      } else if (y > tileSize - iconSize) {
        icons.push(generateIconElement(icon.svg, drawX, drawY - tileSize, iconSize, rotation));
      }

      // Wrap diagonally if near corner
      if (x < iconSize && y < iconSize) {
        icons.push(generateIconElement(icon.svg, drawX + tileSize, drawY + tileSize, iconSize, rotation));
      } else if (x > tileSize - iconSize && y < iconSize) {
        icons.push(generateIconElement(icon.svg, drawX - tileSize, drawY + tileSize, iconSize, rotation));
      } else if (x < iconSize && y > tileSize - iconSize) {
        icons.push(generateIconElement(icon.svg, drawX + tileSize, drawY - tileSize, iconSize, rotation));
      } else if (x > tileSize - iconSize && y > tileSize - iconSize) {
        icons.push(generateIconElement(icon.svg, drawX - tileSize, drawY - tileSize, iconSize, rotation));
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}" style="color: ${strokeColor}">
    <rect width="100%" height="100%" fill="transparent"/>
    ${icons.join("\n    ")}
  </svg>`;
}

// Convert SVG to data URL for use in CSS background-image
export function generateChatPatternDataURL(
  strokeColor: string,
  iconTheme: IconThemeId = "nature",
  tileSize: number = 500,
  seed: number = 42
): string {
  const svg = generateChatPatternSVG(strokeColor, iconTheme, tileSize, seed);
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `data:image/svg+xml,${encoded}`;
}

// Get CSS background style for the chat pattern
export function getChatPatternStyle(
  strokeColor: string,
  iconTheme: IconThemeId = "nature"
): React.CSSProperties {
  const dataUrl = generateChatPatternDataURL(strokeColor, iconTheme);
  return {
    backgroundImage: `url("${dataUrl}")`,
    backgroundRepeat: "repeat",
    backgroundSize: "500px 500px",
  };
}

// Theme-specific stroke colors (low contrast, tone-on-tone)
export const THEME_PATTERN_COLORS: Record<string, string> = {
  light: "rgba(0, 0, 0, 0.05)",
  dark: "rgba(255, 255, 255, 0.05)",
  orange: "rgba(255, 255, 255, 0.07)",
  green: "rgba(255, 255, 255, 0.07)",
  blue: "rgba(255, 255, 255, 0.08)",
};

// Get pattern stroke color for a theme
export function getPatternStrokeColor(themeId: string): string {
  return THEME_PATTERN_COLORS[themeId] || THEME_PATTERN_COLORS.light;
}

// Storage key for icon theme preference
const ICON_THEME_STORAGE_KEY = "chat_icon_theme";

// React hook to get chat pattern styles based on current theme and icon theme
export function useChatPattern(): React.CSSProperties {
  const [colorThemeId, setColorThemeId] = React.useState<string>("light");
  const [iconTheme, setIconTheme] = React.useState<IconThemeId>("nature");

  React.useEffect(() => {
    // Get color theme from HTML element classes
    const getThemeFromClasses = () => {
      const root = document.documentElement;
      for (const theme of Object.keys(THEME_PATTERN_COLORS)) {
        if (theme !== "light" && root.classList.contains(`theme-${theme}`)) {
          return theme;
        }
      }
      return "light";
    };

    // Get icon theme from localStorage
    const savedIconTheme = localStorage.getItem(ICON_THEME_STORAGE_KEY);
    if (savedIconTheme && savedIconTheme in ICON_THEMES) {
      setIconTheme(savedIconTheme as IconThemeId);
    }

    setColorThemeId(getThemeFromClasses());

    // Observe class changes on html element
    const observer = new MutationObserver(() => {
      setColorThemeId(getThemeFromClasses());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Listen for icon theme changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ICON_THEME_STORAGE_KEY && e.newValue) {
        if (e.newValue in ICON_THEMES) {
          setIconTheme(e.newValue as IconThemeId);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const strokeColor = getPatternStrokeColor(colorThemeId);
  return getChatPatternStyle(strokeColor, iconTheme);
}

// Hook to manage icon theme selection
export function useIconTheme() {
  const [iconTheme, setIconThemeState] = React.useState<IconThemeId>("nature");

  React.useEffect(() => {
    const saved = localStorage.getItem(ICON_THEME_STORAGE_KEY);
    if (saved && saved in ICON_THEMES) {
      setIconThemeState(saved as IconThemeId);
    }
  }, []);

  const setIconTheme = React.useCallback((theme: IconThemeId) => {
    setIconThemeState(theme);
    localStorage.setItem(ICON_THEME_STORAGE_KEY, theme);
    // Trigger storage event for other tabs/hooks
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: ICON_THEME_STORAGE_KEY,
        newValue: theme,
      })
    );
  }, []);

  return {
    iconTheme,
    setIconTheme,
    themes: ICON_THEMES,
  };
}
