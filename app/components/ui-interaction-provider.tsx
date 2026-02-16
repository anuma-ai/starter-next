"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

/**
 * Represents a pending user interaction that needs to be resolved
 */
type PendingInteraction = {
  id: string;
  type: "choice" | "form";
  data: any;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  createdAt: number;
  resolved?: boolean;
  result?: any;
};

/**
 * Context value for UI interactions
 */
type UIInteractionContextValue = {
  pendingInteractions: Map<string, PendingInteraction>;
  createInteraction: (id: string, type: "choice" | "form", data: any) => Promise<any>;
  resolveInteraction: (id: string, result: any) => void;
  cancelInteraction: (id: string) => void;
  clearInteractions: () => void;
};

const UIInteractionContext = createContext<UIInteractionContextValue | null>(
  null
);

/**
 * Hook to access UI interaction context
 */
export function useUIInteraction() {
  const context = useContext(UIInteractionContext);
  if (!context) {
    throw new Error(
      "useUIInteraction must be used within UIInteractionProvider"
    );
  }
  return context;
}

type UIInteractionProviderProps = {
  children: ReactNode;
};

/**
 * Provider for managing UI interactions between LLM tools and user
 *
 * This provider manages pending interactions that are created when the LLM
 * calls a UI interaction tool (like prompt_user_choice). The interactions
 * are rendered inline in the chat, and when the user responds, the provider
 * resolves the promise to send the result back to the LLM.
 */
export function UIInteractionProvider({ children }: UIInteractionProviderProps) {
  const [pendingInteractions, setPendingInteractions] = useState<
    Map<string, PendingInteraction>
  >(new Map());

  // Cleanup timer for old interactions
  const cleanupTimerRef = useRef<NodeJS.Timeout>(undefined);

  /**
   * Create a new pending interaction and return a promise that resolves
   * when the user responds
   */
  const createInteraction = useCallback(
    (id: string, type: "choice" | "form", data: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        const interaction: PendingInteraction = {
          id,
          type,
          data,
          resolve,
          reject,
          createdAt: Date.now(),
        };

        setPendingInteractions((prev) => {
          const next = new Map(prev);
          next.set(id, interaction);
          return next;
        });

        // Setup cleanup timer for stale interactions (5 minutes)
        if (cleanupTimerRef.current) {
          clearTimeout(cleanupTimerRef.current);
        }

        cleanupTimerRef.current = setTimeout(() => {
          setPendingInteractions((prev) => {
            const now = Date.now();
            const next = new Map(prev);
            let hasChanges = false;

            for (const [key, value] of next.entries()) {
              // Remove interactions older than 5 minutes
              if (now - value.createdAt > 5 * 60 * 1000) {
                value.reject(new Error("Interaction timeout"));
                next.delete(key);
                hasChanges = true;
              }
            }

            return hasChanges ? next : prev;
          });
        }, 5 * 60 * 1000);
      });
    },
    []
  );

  /**
   * Resolve a pending interaction with a result
   */
  const resolveInteraction = useCallback((id: string, result: any) => {
    setPendingInteractions((prev) => {
      const interaction = prev.get(id);
      if (!interaction) {
        return prev;
      }

      // Resolve the promise
      interaction.resolve(result);

      // Mark as resolved and store result (keep it for display)
      const next = new Map(prev);
      next.set(id, { ...interaction, resolved: true, result });

      return next;
    });
  }, []);

  /**
   * Clear all interactions (e.g. on conversation switch)
   */
  const clearInteractions = useCallback(() => {
    setPendingInteractions(new Map());
  }, []);

  /**
   * Cancel a pending interaction
   */
  const cancelInteraction = useCallback((id: string) => {
    setPendingInteractions((prev) => {
      const interaction = prev.get(id);
      if (!interaction) {
        return prev;
      }

      // Reject the promise
      interaction.reject(new Error("Interaction cancelled by user"));

      // Remove from pending interactions
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const contextValue = useMemo<UIInteractionContextValue>(
    () => ({
      pendingInteractions,
      createInteraction,
      resolveInteraction,
      cancelInteraction,
      clearInteractions,
    }),
    [pendingInteractions, createInteraction, resolveInteraction, cancelInteraction, clearInteractions]
  );

  return (
    <UIInteractionContext.Provider value={contextValue}>
      {children}
    </UIInteractionContext.Provider>
  );
}
