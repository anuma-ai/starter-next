"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  RightSidebarProvider,
  useRightSidebar,
} from "@/components/ui/right-sidebar";

type ThinkingPanelContextValue = {
  content: string;
  isStreaming: boolean;
  duration: number | undefined;
  openPanel: (
    content: string,
    isStreaming?: boolean,
    duration?: number
  ) => void;
  updateContent: (content: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  setDuration: (duration: number | undefined) => void;
};

const ThinkingPanelContext = createContext<ThinkingPanelContextValue | null>(
  null
);

export const useThinkingPanel = () => {
  const context = useContext(ThinkingPanelContext);
  const rightSidebar = useRightSidebar();
  if (!context) {
    throw new Error(
      "useThinkingPanel must be used within ThinkingPanelProvider"
    );
  }
  return { ...context, ...rightSidebar };
};

type ThinkingPanelProviderProps = {
  children: ReactNode;
};

function ThinkingPanelProviderInner({ children }: ThinkingPanelProviderProps) {
  const rightSidebar = useRightSidebar();
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [duration, setDuration] = useState<number | undefined>(undefined);

  const openPanel = useCallback(
    (newContent: string, streaming = false, dur?: number) => {
      setContent(newContent);
      setIsStreaming(streaming);
      setDuration(dur);
      if (rightSidebar.isMobile) {
        rightSidebar.setOpenMobile(true);
      } else {
        rightSidebar.setOpen(true);
      }
    },
    [rightSidebar]
  );

  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const setStreamingValue = useCallback((streaming: boolean) => {
    setIsStreaming(streaming);
  }, []);

  const setDurationValue = useCallback((dur: number | undefined) => {
    setDuration(dur);
  }, []);

  const contextValue = useMemo<ThinkingPanelContextValue>(
    () => ({
      content,
      isStreaming,
      duration,
      openPanel,
      updateContent,
      setStreaming: setStreamingValue,
      setDuration: setDurationValue,
    }),
    [
      content,
      isStreaming,
      duration,
      openPanel,
      updateContent,
      setStreamingValue,
      setDurationValue,
    ]
  );

  return (
    <ThinkingPanelContext.Provider value={contextValue}>
      {children}
    </ThinkingPanelContext.Provider>
  );
}

export function ThinkingPanelProvider({ children }: ThinkingPanelProviderProps) {
  return (
    <RightSidebarProvider>
      <ThinkingPanelProviderInner>{children}</ThinkingPanelProviderInner>
    </RightSidebarProvider>
  );
}
