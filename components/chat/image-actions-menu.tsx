"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardCircleIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useNftMint } from "@/hooks/useNftMint";
import { cn } from "@/lib/utils";

type ImageActionsMenuProps = {
  imageUrl: string;
  children?: React.ReactNode;
};

function useCornerLuminance(imageUrl: string) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        // Sample top-right corner (20x20 area scaled to 1 pixel)
        const sx = Math.max(0, img.naturalWidth - 20);
        ctx.drawImage(img, sx, 0, 20, 20, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        setIsDark(luminance < 0.5);
      } catch {
        // CORS-tainted canvas, default to dark background assumption
        setIsDark(true);
      }
    };
    img.src = imageUrl;
  }, [imageUrl]);

  return isDark;
}

export function ImageActionsMenu({ imageUrl, children }: ImageActionsMenuProps) {
  const { mint, mintState, explorerUrl } = useNftMint(imageUrl);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDark = useCornerLuminance(imageUrl);

  const overlay = (
    <div
      className={cn(
        "absolute -top-2 -right-2 z-10",
        isMenuOpen
          ? "opacity-100"
          : "opacity-0 pointer-events-none group-hover/image:opacity-100 group-hover/image:pointer-events-auto"
      )}
    >
      <DropdownMenu onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full bg-white p-1.5 cursor-pointer shadow-[0_0_4px_rgba(0,0,0,0.1)] hover:bg-white/90">
            <HugeiconsIcon
              icon={DashboardCircleIcon}
              className={cn("size-4", isDark ? "text-white" : "text-black")}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {mintState.status === "success" ? (
            <DropdownMenuItem asChild>
              <a href={explorerUrl!} target="_blank" rel="noopener noreferrer">
                View on Explorer
              </a>
            </DropdownMenuItem>
          ) : mintState.status === "minting" ? (
            <DropdownMenuItem disabled>
              <Loader2 className="size-4 animate-spin mr-2" />
              Minting...
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => mint()}>
              Create an NFT
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (!children) {
    return overlay;
  }

  return (
    <div className="group/image relative w-fit">
      {children}
      {overlay}
    </div>
  );
}
