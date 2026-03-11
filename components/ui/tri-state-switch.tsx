"use client"

import * as React from "react"
import { X } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

type TriState = "auto" | "enable" | "disable"

interface TriStateSwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  value?: TriState
  onChange?: (value: TriState) => void
  /** When true, only cycles between enable/disable (skips auto) */
  twoStateMode?: boolean
}

function TriStateSwitch({
  className,
  value = "auto",
  onChange,
  onClick,
  twoStateMode = false,
  ...props
}: TriStateSwitchProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    let nextState: TriState
    if (twoStateMode) {
      // Two-state mode: toggle between enable and disable
      nextState = value === "enable" ? "disable" : "enable"
    } else {
      // Three-state mode: auto -> enable -> disable -> auto
      nextState = value === "auto" ? "enable" : value === "enable" ? "disable" : "auto"
    }
    onChange?.(nextState)
  }

  // In two-state mode, treat "auto" as "disable" for positioning
  const effectiveValue = twoStateMode && value === "auto" ? "disable" : value

  // Map to data-state for styling (enable=checked, disable/auto=unchecked)
  const dataState = effectiveValue === "enable" ? "checked" : "unchecked"

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
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none flex items-center justify-center size-4 rounded-full ring-0 transition-transform",
          effectiveValue === "disable" && "translate-x-0",
          effectiveValue === "auto" && "translate-x-[7px]",
          effectiveValue === "enable" && "translate-x-[14px]"
        )}
        data-state={dataState}
      >
        {effectiveValue === "disable" && (
          <X size={10} weight="bold" className="text-neutral-300" />
        )}
      </span>
    </button>
  )
}

export { TriStateSwitch }
export type { TriState, TriStateSwitchProps }
