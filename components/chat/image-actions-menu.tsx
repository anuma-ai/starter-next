"use client";

import { useState } from "react";
import { MoreVertical, Loader2 } from "lucide-react";
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

export function ImageActionsMenu({ imageUrl, children }: ImageActionsMenuProps) {
  const { mint, mintState, explorerUrl } = useNftMint(imageUrl);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const overlay = (
    <div
      className={cn(
        "absolute top-2 right-2 transition-opacity z-10",
        isMenuOpen ? "opacity-100" : "opacity-0 group-hover/image:opacity-100"
      )}
    >
      <DropdownMenu onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full bg-background/80 backdrop-blur-sm p-1.5 cursor-pointer hover:bg-background/90 transition-colors">
            <MoreVertical className="size-4 text-foreground" />
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
    <div className="group/image relative">
      {children}
      {overlay}
    </div>
  );
}
