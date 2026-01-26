"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { SearchIcon } from "lucide-react";
import openmojiData from "openmoji/data/openmoji.json";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { FolderLibraryIcon } from "@hugeicons/core-free-icons";

// Type for openmoji metadata
type OpenmojiEntry = {
  hexcode: string;
  annotation: string;
  group: string;
  subgroups: string;
  skintone: string;
};

// Get all valid icons (no compound emojis, no skin tone variants)
const ALL_ICONS = (openmojiData as OpenmojiEntry[]).filter((emoji) => {
  // Skip compound emojis (with dashes in hexcode)
  if (emoji.hexcode.includes("-")) return false;
  // Skip skin tone variants
  if (emoji.skintone) return false;
  return true;
});

// Dynamically import SVG files using webpack's require.context
const svgContext = require.context(
  "openmoji/black/svg",
  false,
  /^\.\/[A-Fa-f0-9]+\.svg$/
);

// Cache for loaded SVG data URLs
const svgUrlCache = new Map<string, string>();

// Apply color, stroke width, and optional scale to SVG content
// scale > 1 crops the viewBox padding to make the icon appear larger
function applyColor(svg: string, color: string, strokeWidth?: number, scale?: number): string {
  // Step 1: Add fill="#000" to shape elements that don't have any fill attribute
  // This makes the default black fill explicit so we can replace it in step 3
  let result = svg.replace(
    /<(path|circle|ellipse|rect|polygon|polyline)\s+([^>]*?)(\s*\/?>)/g,
    (match, tag, attrs, closing) => {
      if (/\bfill\s*=/.test(attrs)) {
        return match; // Already has fill attribute
      }
      // If it has stroke, it's probably meant to be stroke-only
      if (/\bstroke\s*=/.test(attrs)) {
        return match;
      }
      return `<${tag} ${attrs.trim()} fill="#000"${closing}`;
    }
  );

  // Step 2: Add stroke="#000" to elements that have stroke-width but no stroke color
  result = result.replace(
    /<(path|circle|ellipse|rect|polygon|polyline|line)\s+([^>]*?)(\s*\/?>)/g,
    (match, tag, attrs, closing) => {
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

  // Step 4: Optionally adjust stroke width
  if (strokeWidth !== undefined) {
    result = result.replace(/stroke-width="[^"]+"/g, `stroke-width="${strokeWidth}"`);
  }

  // Step 5: Optionally scale by cropping viewBox (removes padding to make icon larger)
  // Openmoji icons have viewBox="0 0 72 72" with ~10% padding on each side
  if (scale !== undefined && scale > 1) {
    const originalSize = 72;
    const newSize = originalSize / scale;
    const offset = (originalSize - newSize) / 2;
    result = result.replace(
      /viewBox="0 0 72 72"/,
      `viewBox="${offset} ${offset} ${newSize} ${newSize}"`
    );
  }

  return result;
}

// Load an SVG and convert to data URL with custom color, stroke width, and scale
function getSvgDataUrl(hexcode: string, color: string = "currentColor", strokeWidth?: number, scale?: number): string | null {
  const cacheKey = `${hexcode}-${color}-${strokeWidth ?? "default"}-${scale ?? "default"}`;
  if (svgUrlCache.has(cacheKey)) {
    return svgUrlCache.get(cacheKey)!;
  }

  try {
    const svgContent = svgContext(`./${hexcode}.svg`) as string;
    const coloredSvg = applyColor(svgContent, color, strokeWidth, scale);

    const encoded = encodeURIComponent(coloredSvg)
      .replace(/'/g, "%27")
      .replace(/"/g, "%22");
    const dataUrl = `data:image/svg+xml,${encoded}`;
    svgUrlCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

// Icon component that renders an openmoji
export function ProjectIcon({
  hexcode,
  size = 24,
  color,
  strokeWidth,
  scale,
  className = "",
}: {
  hexcode: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  scale?: number; // > 1 crops padding to make icon fill more space
  className?: string;
}) {
  // Use provided color, or default based on theme
  const effectiveColor = color || "#000";
  const dataUrl = useMemo(
    () => getSvgDataUrl(hexcode, effectiveColor, strokeWidth, scale),
    [hexcode, effectiveColor, strokeWidth, scale]
  );

  if (!dataUrl) {
    return <div className={`bg-muted rounded ${className}`} style={{ width: size, height: size }} />;
  }

  return (
    <img
      src={dataUrl}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

// Check if current theme needs white icons (non-light themes)
function checkNeedsWhiteIcon(): boolean {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  // Use white icons for any non-light theme
  return root.classList.contains("dark") ||
    root.classList.contains("theme-dark") ||
    root.classList.contains("theme-orange") ||
    root.classList.contains("theme-green") ||
    root.classList.contains("theme-blue");
}

// Icon component that auto-detects theme
export function ThemedProjectIcon({
  hexcode,
  size = 24,
  strokeWidth,
  scale,
  className = "",
}: {
  hexcode: string;
  size?: number;
  strokeWidth?: number;
  scale?: number;
  className?: string;
}) {
  // Initialize with current theme state to avoid flash
  const [useWhite, setUseWhite] = useState(checkNeedsWhiteIcon);

  React.useEffect(() => {
    // Re-check on mount (in case SSR mismatch)
    setUseWhite(checkNeedsWhiteIcon());

    // Observe class changes for theme switches
    const observer = new MutationObserver(() => {
      setUseWhite(checkNeedsWhiteIcon());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ProjectIcon
      hexcode={hexcode}
      size={size}
      strokeWidth={strokeWidth}
      scale={scale}
      color={useWhite ? "#fff" : "#000"}
      className={className}
    />
  );
}

type ProjectIconPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIcon?: string;
  onSelectIcon: (hexcode: string | undefined) => void;
};

export function ProjectIconPicker({
  open,
  onOpenChange,
  selectedIcon,
  onSelectIcon,
}: ProjectIconPickerProps) {
  const [search, setSearch] = useState("");

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!search.trim()) {
      // Return a reasonable subset when no search (most commonly used groups)
      return ALL_ICONS.filter((icon) =>
        ["smileys-emotion", "animals-nature", "food-drink", "activities", "objects", "symbols"].includes(icon.group)
      ).slice(0, 200);
    }

    const searchLower = search.toLowerCase();
    return ALL_ICONS.filter((icon) =>
      icon.annotation.toLowerCase().includes(searchLower) ||
      icon.group.toLowerCase().includes(searchLower) ||
      icon.subgroups.toLowerCase().includes(searchLower)
    ).slice(0, 200);
  }, [search]);

  const handleSelect = useCallback((hexcode: string | undefined) => {
    onSelectIcon(hexcode);
    onOpenChange(false);
    setSearch("");
  }, [onSelectIcon, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Project Icon</DialogTitle>
          <DialogDescription>
            Search and select an icon for your project
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/50">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        {/* Icon grid */}
        <div className="h-[400px] overflow-y-auto">
          <div className="grid grid-cols-6 gap-2 p-2">
            {/* Default folder icon - always first when no search */}
            {!search.trim() && (
              <button
                onClick={() => handleSelect(undefined)}
                className={`p-2 rounded-md hover:bg-muted transition-colors flex items-center justify-center ${
                  !selectedIcon ? "bg-muted ring-2 ring-primary" : ""
                }`}
                title="Default folder icon"
              >
                <HugeiconsIcon icon={FolderLibraryIcon} size={36} />
              </button>
            )}
            {filteredIcons.map((icon) => (
              <button
                key={icon.hexcode}
                onClick={() => handleSelect(icon.hexcode)}
                className={`p-2 rounded-md hover:bg-muted transition-colors flex items-center justify-center ${
                  selectedIcon === icon.hexcode ? "bg-muted ring-2 ring-primary" : ""
                }`}
                title={icon.annotation}
              >
                <ThemedProjectIcon hexcode={icon.hexcode} size={36} />
              </button>
            ))}
          </div>
          {filteredIcons.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No icons found for &quot;{search}&quot;
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
