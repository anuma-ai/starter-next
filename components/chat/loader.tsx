"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type LoaderIconProps = {
  size?: number;
};

const LoaderIcon = ({ size = 16 }: LoaderIconProps) => {
  const dotSize = size * 0.5;

  return (
    <div
      className="flex items-center justify-center"
      style={{ height: size, width: size }}
    >
      <div
        className="rounded-full bg-current animate-pulse-dot flex-shrink-0"
        style={{
          width: dotSize,
          height: dotSize,
          minWidth: dotSize,
          minHeight: dotSize,
        }}
      />
    </div>
  );
};

export type LoaderProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
};

export const Loader = ({ className, size = 16, ...props }: LoaderProps) => (
  <div
    className={cn("inline-flex items-center justify-center", className)}
    {...props}
  >
    <LoaderIcon size={size} />
  </div>
);
