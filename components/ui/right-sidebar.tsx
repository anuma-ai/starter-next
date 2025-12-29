"use client"

import * as React from "react"

import { useIsMobile } from "@/hooks/useMobile"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const RIGHT_SIDEBAR_WIDTH = "400px"
const RIGHT_SIDEBAR_WIDTH_MOBILE = "85vw"

type RightSidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const RightSidebarContext = React.createContext<RightSidebarContextProps | null>(null)

function useRightSidebar() {
  const context = React.useContext(RightSidebarContext)
  if (!context) {
    throw new Error("useRightSidebar must be used within a RightSidebarProvider.")
  }

  return context
}

function RightSidebarProvider({
  defaultOpen = false,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }
    },
    [setOpenProp, open]
  )

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<RightSidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <RightSidebarContext.Provider value={contextValue}>
      <div
        data-slot="right-sidebar-wrapper"
        style={
          {
            "--right-sidebar-width": RIGHT_SIDEBAR_WIDTH,
            ...style,
          } as React.CSSProperties
        }
        className={cn("contents", className)}
        {...props}
      >
        {children}
      </div>
    </RightSidebarContext.Provider>
  )
}

function RightSidebar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile, state, openMobile, setOpenMobile } = useRightSidebar()

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="right-sidebar"
          data-mobile="true"
          className="bg-background text-foreground w-[var(--right-sidebar-width)] max-w-[400px] p-0 [&>button]:hidden"
          style={
            {
              "--right-sidebar-width": RIGHT_SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side="right"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Panel</SheetTitle>
            <SheetDescription>Side panel content.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? "offcanvas" : ""}
      data-variant="sidebar"
      data-side="right"
      data-slot="right-sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="right-sidebar-gap"
        className={cn(
          "relative w-[var(--right-sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0"
        )}
      />
      <div
        data-slot="right-sidebar-container"
        className={cn(
          "fixed inset-y-0 right-0 z-10 hidden h-svh w-[var(--right-sidebar-width)] transition-[right] duration-200 ease-linear md:flex",
          "group-data-[collapsible=offcanvas]:right-[calc(var(--right-sidebar-width)*-1)]",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="right-sidebar-inner"
          className="bg-background flex h-full w-full flex-col font-medium border-l border-border"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function RightSidebarHandle({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar, state, openMobile, setOpenMobile, isMobile } = useRightSidebar()

  if (isMobile) {
    return null
  }

  return (
    <button
      onClick={toggleSidebar}
      className={cn(
        "fixed top-0 bottom-0 z-50 group/handle cursor-ew-resize hidden md:flex items-center justify-center transition-[right,width,background-color] duration-200 ease-linear",
        state === "collapsed" ? "w-8 hover:bg-black/[0.02] dark:hover:bg-muted/50" : "w-5",
        className
      )}
      style={{
        right: state === "collapsed" ? 0 : "var(--right-sidebar-width)"
      }}
      aria-label="Toggle Right Sidebar"
      {...props}
    >
      <div className="h-16 w-1.5 rounded-full bg-neutral-300 hover:bg-neutral-400 dark:bg-neutral-600 dark:hover:bg-neutral-500 opacity-0 group-hover/handle:opacity-100 transition-opacity" />
    </button>
  )
}

function RightSidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="right-sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function RightSidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="right-sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto",
        className
      )}
      {...props}
    />
  )
}

function RightSidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="right-sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

export {
  RightSidebar,
  RightSidebarContent,
  RightSidebarFooter,
  RightSidebarHandle,
  RightSidebarHeader,
  RightSidebarProvider,
  useRightSidebar,
}
