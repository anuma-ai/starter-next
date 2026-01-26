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
    subgroups: ["plant-flower", "plant-other"],
    description: "Plants, flowers, and weather",
  },
  animals: {
    name: "Animals",
    group: "animals-nature",
    subgroups: [
      "animal-mammal",
      "animal-bird",
      "animal-amphibian",
      "animal-reptile",
      "animal-marine",
      "animal-bug",
    ],
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
function getIconsForTheme(themeId: IconThemeId, limit: number = 20): string[] {
  const theme = ICON_THEMES[themeId];
  const themeSubgroups: readonly string[] | undefined =
    "subgroups" in theme ? theme.subgroups : undefined;

  // Filter icons by group, excluding compound emojis (with dashes) and skin tone variants
  const icons = (openmojiData as Array<{
    hexcode: string;
    group: string;
    subgroups: string;
    skintone: string;
  }>)
    .filter((emoji) => {
      // Must match group
      if (emoji.group !== theme.group) return false;
      // Skip compound emojis
      if (emoji.hexcode.includes("-")) return false;
      // Skip skin tone variants
      if (emoji.skintone) return false;
      // If theme has subgroups filter, must match one of them
      if (themeSubgroups && !themeSubgroups.includes(emoji.subgroups)) {
        return false;
      }
      return true;
    })
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
// Regex matches hexcode filenames (uppercase A-F and digits 0-9)
const svgContext = require.context(
  "openmoji/black/svg",
  false,
  /^\.\/[A-Fa-f0-9]+\.svg$/
);

// Cache for loaded SVG content (stores raw extracted content, not color-normalized)
// Cache is cleared on each module load to ensure fresh data
const svgCache = new Map<string, string>();
svgCache.clear(); // Ensure clean slate

// Debug: expose function to test SVG loading (call from browser console)
if (typeof window !== "undefined") {
  const debugSvgLoad = (hexcode: string) => {
    try {
      const content = svgContext(`./${hexcode}.svg`);
      console.log(`[debug] ${hexcode} type:`, typeof content);
      console.log(`[debug] ${hexcode} length:`, typeof content === "string" ? content.length : "N/A");
      console.log(`[debug] ${hexcode} first 100:`, typeof content === "string" ? content.substring(0, 100) : content);
      return content;
    } catch (e) {
      console.error(`[debug] ${hexcode} error:`, e);
      return null;
    }
  };
  const debugThemeIcons = (themeId: string) => {
    const hexcodes = getIconsForTheme(themeId as IconThemeId);
    console.log(`[debug] ${themeId} hexcodes:`, hexcodes);
    hexcodes.slice(0, 3).forEach(hex => debugSvgLoad(hex));
  };
  const debugPatternIcons = (themeId: string) => {
    const icons = getPatternIcons(themeId as IconThemeId);
    console.log(`[debug] ${themeId} patternIcons count:`, icons.length);
    icons.slice(0, 3).forEach(icon => {
      console.log(`[debug] ${icon.name} svg length:`, icon.svg.length);
      console.log(`[debug] ${icon.name} svg first 100:`, icon.svg.substring(0, 100));
    });
  };
  const debugFullPattern = (themeId: string) => {
    const strokeColor = "#404040"; // dark theme color
    const svg = generateChatPatternSVG(strokeColor, themeId as IconThemeId);
    console.log(`[debug] ${themeId} full SVG length:`, svg.length);
    console.log(`[debug] ${themeId} SVG start:`, svg.substring(0, 200));
    console.log(`[debug] ${themeId} SVG contains icons:`, svg.includes("<g transform"));

    const dataUrl = generateChatPatternDataURL(strokeColor, themeId as IconThemeId);
    console.log(`[debug] ${themeId} dataURL length:`, dataUrl.length);
    console.log(`[debug] ${themeId} dataURL start:`, dataUrl.substring(0, 100));
  };

  // Debug: test rendering SVG directly in DOM
  const debugRenderPattern = (themeId: string) => {
    const strokeColor = "#404040";
    const svg = generateChatPatternSVG(strokeColor, themeId as IconThemeId);
    const dataUrl = generateChatPatternDataURL(strokeColor, themeId as IconThemeId);

    // Create a test div
    const testDiv = document.createElement("div");
    testDiv.id = `debug-pattern-${themeId}`;
    testDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      width: 300px;
      height: 300px;
      border: 2px solid red;
      background-color: #f0f0f0;
      background-image: url("${dataUrl}");
      background-repeat: repeat;
      background-size: 150px 150px;
      z-index: 99999;
    `;
    document.body.appendChild(testDiv);

    // Also create an img element to test
    const img = document.createElement("img");
    img.id = `debug-img-${themeId}`;
    img.src = dataUrl;
    img.style.cssText = `
      position: fixed;
      top: 10px;
      left: 320px;
      width: 300px;
      height: 300px;
      border: 2px solid blue;
      z-index: 99999;
    `;
    img.onerror = () => console.error(`[debug] ${themeId} img failed to load`);
    img.onload = () => console.log(`[debug] ${themeId} img loaded successfully`);
    document.body.appendChild(img);

    console.log(`[debug] ${themeId} test elements created. Remove with: document.getElementById('debug-pattern-${themeId}').remove(); document.getElementById('debug-img-${themeId}').remove();`);
    return { svg, dataUrl };
  };

  // Debug: compare raw SVG content between two themes
  const debugCompareThemes = (theme1: string, theme2: string) => {
    const hexcodes1 = getIconsForTheme(theme1 as IconThemeId);
    const hexcodes2 = getIconsForTheme(theme2 as IconThemeId);

    console.log(`[debug] ${theme1} first hexcode:`, hexcodes1[0]);
    console.log(`[debug] ${theme2} first hexcode:`, hexcodes2[0]);

    // Get raw SVG content
    const raw1 = svgContext(`./${hexcodes1[0]}.svg`) as string;
    const raw2 = svgContext(`./${hexcodes2[0]}.svg`) as string;

    console.log(`[debug] ${theme1} raw length:`, raw1.length);
    console.log(`[debug] ${theme2} raw length:`, raw2.length);

    // Check if they have <g id="line">
    console.log(`[debug] ${theme1} has <g id="line">:`, raw1.includes('<g id="line"'));
    console.log(`[debug] ${theme2} has <g id="line">:`, raw2.includes('<g id="line"'));

    // Show the structure
    console.log(`[debug] ${theme1} raw SVG (first 500):`, raw1.substring(0, 500));
    console.log(`[debug] ${theme2} raw SVG (first 500):`, raw2.substring(0, 500));
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).debugSvgLoad = debugSvgLoad;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).debugThemeIcons = debugThemeIcons;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).debugPatternIcons = debugPatternIcons;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).debugFullPattern = debugFullPattern;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).debugRenderPattern = debugRenderPattern;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).debugCompareThemes = debugCompareThemes;
}

// Load an SVG by hexcode (returns raw extracted content without color normalization)
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
// Returns raw content - color normalization is done later with actual color value
function extractSvgContent(svgString: string): string {
  // Find the <g id="line"> group which contains the outline paths
  // We need to handle nested <g> elements properly by counting open/close tags
  const lineStartMatch = svgString.match(/<g id="line"[^>]*>/);
  if (lineStartMatch) {
    const startIndex = lineStartMatch.index! + lineStartMatch[0].length;
    let depth = 1;
    let endIndex = startIndex;

    // Walk through the string, tracking nested <g> depth
    for (let i = startIndex; i < svgString.length; i++) {
      // Check for opening <g> tag
      if (svgString.slice(i, i + 2) === "<g") {
        const tagEnd = svgString.indexOf(">", i);
        if (tagEnd !== -1) {
          // Check if it's a self-closing tag <g ... />
          if (svgString[tagEnd - 1] !== "/") {
            depth++;
          }
          i = tagEnd;
        }
      }
      // Check for closing </g> tag
      else if (svgString.slice(i, i + 4) === "</g>") {
        depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
        i += 3; // Skip past </g>
      }
    }

    if (depth === 0) {
      return svgString.slice(startIndex, endIndex);
    }
  }

  // Fallback: extract all path/polygon/circle/line elements
  const elements = svgString.match(
    /<(path|polygon|circle|ellipse|line|polyline|rect)[^>]*\/?>/g
  );
  if (elements) {
    return elements.join("\n");
  }

  return "";
}

// Apply color to SVG content - replaces black strokes/fills with the specified color
function applyColor(svg: string, color: string): string {
  // Step 1: Add fill="#000" to shape elements that don't have any fill attribute
  // This makes the default black fill explicit so we can replace it in step 3
  // We target: path, circle, ellipse, rect, polygon, polyline
  // But NOT elements that have stroke but no fill (those are outline-only)
  let result = svg.replace(
    /<(path|circle|ellipse|rect|polygon|polyline)\s+([^>]*?)(\s*\/?>)/g,
    (match, tag, attrs, closing) => {
      if (/\bfill\s*=/.test(attrs)) {
        return match; // Already has fill attribute
      }
      // If it has stroke, it's probably meant to be stroke-only (fill transparent)
      // If it has no stroke and no fill, it's a solid black shape by default
      if (/\bstroke\s*=/.test(attrs)) {
        return match; // Has stroke, leave fill as default (transparent for stroked elements)
      }
      return `<${tag} ${attrs.trim()} fill="#000"${closing}`;
    }
  );

  // Step 2: Add stroke="#000" to elements that have stroke-width but no stroke color
  // Without explicit stroke color, SVG defaults to currentColor which could be white on dark themes
  result = result.replace(
    /<(path|circle|ellipse|rect|polygon|polyline|line)\s+([^>]*?)(\s*\/?>)/g,
    (match, tag, attrs, closing) => {
      // If it has stroke-width but no stroke color, add explicit stroke
      if (/\bstroke-width\s*=/.test(attrs) && !/\bstroke\s*=/.test(attrs)) {
        return `<${tag} ${attrs.trim()} stroke="#000"${closing}`;
      }
      return match;
    }
  );

  // Step 3: Replace all black colors with the target color
  result = result
    .replace(/stroke="#000000"/g, `stroke="${color}"`)
    .replace(/stroke="#000"/g, `stroke="${color}"`)
    .replace(/stroke="black"/g, `stroke="${color}"`)
    .replace(/fill="#000000"/g, `fill="${color}"`)
    .replace(/fill="#000"/g, `fill="${color}"`)
    .replace(/fill="black"/g, `fill="${color}"`);

  return result;
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
    (tileSize * tileSize) / (avgIconSize * avgIconSize * 3.2)
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

    const minDistance = avgIconSize * 1.25;
    if (!checkOverlap(x, y, minDistance)) {
      positions.push({ x, y, size: iconSize });
      const icon = patternIcons[i % patternIcons.length];
      const coloredSvg = applyColor(icon.svg, strokeColor);
      const drawX = x - iconSize / 2;
      const drawY = y - iconSize / 2;

      // Main position
      icons.push(generateIconElement(coloredSvg, drawX, drawY, iconSize, rotation));

      // Wrap horizontally if near edge
      if (x < iconSize) {
        icons.push(generateIconElement(coloredSvg, drawX + tileSize, drawY, iconSize, rotation));
      } else if (x > tileSize - iconSize) {
        icons.push(generateIconElement(coloredSvg, drawX - tileSize, drawY, iconSize, rotation));
      }

      // Wrap vertically if near edge
      if (y < iconSize) {
        icons.push(generateIconElement(coloredSvg, drawX, drawY + tileSize, iconSize, rotation));
      } else if (y > tileSize - iconSize) {
        icons.push(generateIconElement(coloredSvg, drawX, drawY - tileSize, iconSize, rotation));
      }

      // Wrap diagonally if near corner
      if (x < iconSize && y < iconSize) {
        icons.push(generateIconElement(coloredSvg, drawX + tileSize, drawY + tileSize, iconSize, rotation));
      } else if (x > tileSize - iconSize && y < iconSize) {
        icons.push(generateIconElement(coloredSvg, drawX - tileSize, drawY + tileSize, iconSize, rotation));
      } else if (x < iconSize && y > tileSize - iconSize) {
        icons.push(generateIconElement(coloredSvg, drawX + tileSize, drawY - tileSize, iconSize, rotation));
      } else if (x > tileSize - iconSize && y > tileSize - iconSize) {
        icons.push(generateIconElement(coloredSvg, drawX - tileSize, drawY - tileSize, iconSize, rotation));
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}">
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

// Theme-specific stroke colors (solid colors to avoid layered opacity issues)
// Using solid colors slightly different from background for subtle tone-on-tone effect
export const THEME_PATTERN_COLORS: Record<string, string> = {
  light: "#e8e8e8", // Light gray on white background
  dark: "#404040", // Very subtle gray on dark background (#3d3d3d)
  orange: "#d4885a", // Slightly lighter orange on #c57742
  green: "#3d8050", // Slightly lighter green on #2e6f40
  blue: "#1a1a9a", // Slightly lighter blue on #000080
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

// Hook to get chat pattern styles with project-level overrides
// Project overrides take precedence over global settings
export function useChatPatternWithProject(
  projectColorTheme?: string,
  projectIconTheme?: string
): React.CSSProperties {
  const [globalColorThemeId, setGlobalColorThemeId] =
    React.useState<string>("light");
  const [globalIconTheme, setGlobalIconTheme] =
    React.useState<IconThemeId>("nature");

  React.useEffect(() => {
    // Get global color theme from HTML element classes
    const getThemeFromClasses = () => {
      const root = document.documentElement;
      for (const theme of Object.keys(THEME_PATTERN_COLORS)) {
        if (theme !== "light" && root.classList.contains(`theme-${theme}`)) {
          return theme;
        }
      }
      return "light";
    };

    // Get global icon theme from localStorage
    const savedIconTheme = localStorage.getItem(ICON_THEME_STORAGE_KEY);
    if (savedIconTheme && savedIconTheme in ICON_THEMES) {
      setGlobalIconTheme(savedIconTheme as IconThemeId);
    }

    setGlobalColorThemeId(getThemeFromClasses());

    // Observe class changes on html element
    const observer = new MutationObserver(() => {
      setGlobalColorThemeId(getThemeFromClasses());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Listen for icon theme changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ICON_THEME_STORAGE_KEY && e.newValue) {
        if (e.newValue in ICON_THEMES) {
          setGlobalIconTheme(e.newValue as IconThemeId);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Use project theme if provided, otherwise fall back to global
  const effectiveColorTheme = projectColorTheme || globalColorThemeId;
  const effectiveIconTheme =
    (projectIconTheme as IconThemeId) || globalIconTheme;

  const strokeColor = getPatternStrokeColor(effectiveColorTheme);
  return getChatPatternStyle(strokeColor, effectiveIconTheme);
}
