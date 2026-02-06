"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type TriState = "auto" | "enable" | "disable"

interface TriStateSwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  value?: TriState
  onChange?: (value: TriState) => void
}

function TriStateSwitch({
  className,
  value = "auto",
  onChange,
  onClick,
  ...props
}: TriStateSwitchProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    const nextState: TriState =
      value === "auto" ? "enable" : value === "enable" ? "disable" : "auto"
    onChange?.(nextState)
  }

  // Map to data-state for styling (enable=checked, disable/auto=unchecked)
  const dataState = value === "enable" ? "checked" : "unchecked"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value === "enable"}
      data-slot="switch"
      data-state={dataState}
      {...props}
      onClick={handleClick}
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform",
          value === "disable" && "translate-x-0",
          value === "auto" && "translate-x-[11px]",
          value === "enable" && "translate-x-[22px]"
        )}
        data-state={dataState}
      />
    </button>
  )
}

export { TriStateSwitch }
export type { TriState, TriStateSwitchProps }
