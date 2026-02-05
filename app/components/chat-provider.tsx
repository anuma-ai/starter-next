"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { useIdentityToken, usePrivy, useWallets } from "@privy-io/react-auth";
import { useDatabase } from "@/app/providers";
import { useAppChat } from "@/hooks/useAppChat";
import {
  requestEncryptionKey,
  hasEncryptionKey,
  // Google Calendar Auth
  getValidCalendarToken,
  getCalendarAccessToken,
  startCalendarAuth,
  hasCalendarCredentials,
  storeCalendarPendingMessage,
  getAndClearCalendarPendingMessage,
  // Google Drive Auth (with drive.readonly scope)
  getValidDriveToken,
  getDriveAccessToken,
  startDriveAuth,
  hasDriveCredentials,
  storeDrivePendingMessage,
  getAndClearDrivePendingMessage,
} from "@reverbia/sdk/react";
import { useAppProjects } from "@/hooks/useAppProjects";
import type {
  StoredProject,
  StoredConversation,
  CreateProjectOptions,
} from "@reverbia/sdk/react";
import { createChatTools, createDriveTools } from "@reverbia/sdk/tools";
import { getEnabledTools } from "@/hooks/useAppTools";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

type ChatState = {
  messages: any[];
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (message: any, options?: any) => Promise<void>;
  addMessageOptimistically: (text: string, files?: any[], displayText?: string) => string;
  isLoading: boolean;
  status: any;
  error: string | null;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  subscribeToStreaming: (callback: (text: string) => void) => () => void;
  subscribeToThinking: (callback: (text: string) => void) => () => void;
  conversationId: string | null;
  conversations: any[];
  createConversation: (opts?: { projectId?: string; createImmediately?: boolean }) => Promise<any>;
  setConversationId: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  getMessages: (conversationId: string) => Promise<any[]>;
  getConversation: (id: string) => Promise<any>;
  // Projects
  projects: StoredProject[];
  projectsLoading: boolean;
  projectsReady: boolean;
  inboxProjectId: string | null;
  lastAssignedProjectId: string | null;
  projectConversationsVersion: number;
  createProject: (opts?: CreateProjectOptions) => Promise<StoredProject>;
  updateProjectName: (projectId: string, name: string) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  getProjectConversations: (projectId: string) => Promise<StoredConversation[]>;
  updateConversationProject: (conversationId: string, projectId: string | null) => Promise<boolean>;
  refreshProjects: () => Promise<void>;
  markConversationAssigned: (conversationId: string) => void;
  setPendingProjectAssignment: (projectId: string | null) => void;
  triggerProjectConversationsRefresh: () => void;
  // Encryption state
  encryptionReady: boolean;
};

const ChatContext = createContext<ChatState | null>(null);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}

// Re-export Calendar token utilities for external use
export {
  clearCalendarToken as clearGoogleCalendarToken,
  storeCalendarToken as storeGoogleCalendarToken,
} from "@reverbia/sdk/react";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { identityToken } = useIdentityToken();
  const { user, signMessage: privySignMessage, ready: privyReady } = usePrivy();

  // Wrap Privy's signMessage to match SDK's expected signature
  const signMessage = useCallback(
    async (message: string) => {
      const result = await privySignMessage(
        { message },
        { uiOptions: { showWalletUIs: false } }
      );
      return result.signature;
    },
    [privySignMessage]
  );
  const { wallets } = useWallets();
  const database = useDatabase();
  const [temperature, setTemperature] = useState<number | undefined>(undefined);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number | undefined>(
    undefined
  );
  const [enabledServerTools, setEnabledServerTools] = useState<string[]>(() =>
    getEnabledTools()
  );

  // Get wallet address from user's linked wallet
  const walletAddress = user?.wallet?.address;

  // Find embedded wallet for silent signing (optional)
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");

  // Check if embedded wallet is ready (has address)
  const embeddedWalletReady = embeddedWallet?.address !== undefined;

  // Create embedded wallet signer for silent signing without confirmation modal
  const embeddedWalletSigner = useCallback(
    async (message: string) => {
      if (!embeddedWallet) {
        throw new Error("No embedded wallet available");
      }
      if (!embeddedWallet.address) {
        throw new Error("Embedded wallet not ready (no address)");
      }
      const result = await privySignMessage(
        { message },
        { uiOptions: { showWalletUIs: false } }
      );
      return result.signature;
    },
    [embeddedWallet, privySignMessage]
  );

  // Use refs to capture latest values without causing effect re-runs
  const signMessageRef = useRef(signMessage);
  const embeddedWalletSignerRef = useRef(embeddedWalletSigner);
  const embeddedWalletRef = useRef(embeddedWallet);
  const embeddedWalletReadyRef = useRef(embeddedWalletReady);

  useEffect(() => {
    signMessageRef.current = signMessage;
    embeddedWalletSignerRef.current = embeddedWalletSigner;
    embeddedWalletRef.current = embeddedWallet;
    embeddedWalletReadyRef.current = embeddedWalletReady;
  });

  // Track which wallet addresses we've already initialized encryption for
  const encryptionInitializedRef = useRef<string | null>(null);
  const isInitializingRef = useRef(false);
  // State to track when encryption is ready (for reactive updates)
  // Start as false - will be set to true after encryption is verified/initialized
  const [encryptionReady, setEncryptionReady] = useState(false);

  // Check if wallets are ready (connected) before trying to sign
  // Must wait for Privy to be fully ready AND have an embedded wallet with an address
  // The embedded wallet is required for signing - wait for Privy to create it
  const walletsReady = privyReady && embeddedWallet && embeddedWalletReady;

  // Request encryption key when user logs in with a wallet (only once per wallet)
  // Wait for wallets to be ready to avoid "Unable to connect to wallet" errors
  useEffect(() => {
    // Reset tracking when user signs out
    if (!walletAddress) {
      encryptionInitializedRef.current = null;
      // If no wallet, encryption isn't needed - mark as ready
      if (privyReady) {
        setEncryptionReady(true);
      }
      return;
    }

    // Wait for wallets to be ready before trying to sign
    if (!walletsReady) {
      console.log("Waiting for embedded wallet to be ready:", {
        privyReady,
        hasEmbeddedWallet: !!embeddedWallet,
        embeddedWalletReady,
        walletsCount: wallets.length,
        walletAddress,
      });
      return;
    }

    const initEncryption = async () => {
      // Skip if already initialized for this wallet or currently initializing
      if (encryptionInitializedRef.current === walletAddress) return;
      if (isInitializingRef.current) return;
      if (hasEncryptionKey(walletAddress)) {
        encryptionInitializedRef.current = walletAddress;
        setEncryptionReady(true);
        return;
      }

      isInitializingRef.current = true;
      try {
        // In development, wait a bit for Privy to fully initialize wallet connections
        if (process.env.NODE_ENV === "development") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        // Use refs to get latest values without dependency issues
        const embedded = embeddedWalletRef.current;
        const signer = embedded ? embeddedWalletSignerRef.current : undefined;

        console.log("[Encryption] Initializing for wallet:", walletAddress);
        console.log("[Encryption] Embedded wallet available:", !!embedded);
        console.log("[Encryption] Using embedded signer:", !!signer);

        await requestEncryptionKey(
          walletAddress,
          signMessageRef.current,
          signer
        );
        encryptionInitializedRef.current = walletAddress;
        setEncryptionReady(true);
        console.log("[Encryption] Key initialized successfully");
      } catch (err) {
        console.error("[Encryption] Failed to initialize:", err);
      } finally {
        isInitializingRef.current = false;
      }
    };
    initEncryption();
  }, [walletAddress, walletsReady, privyReady]);

  useEffect(() => {
    const savedTemp = localStorage.getItem("chat_temperature");
    if (savedTemp) {
      const temp = parseFloat(savedTemp);
      // Validate temperature is within acceptable range (0-1)
      if (temp >= 0 && temp <= 1) {
        setTemperature(temp);
      } else {
        console.warn(`Invalid temperature ${temp} in localStorage, ignoring`);
        localStorage.removeItem("chat_temperature");
      }
    }

    const savedMaxTokens = localStorage.getItem("chat_maxOutputTokens");
    if (savedMaxTokens) setMaxOutputTokens(parseInt(savedMaxTokens, 10));

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "chat_temperature" && e.newValue) {
        const temp = parseFloat(e.newValue);
        if (temp >= 0 && temp <= 1) {
          setTemperature(temp);
        }
      }
      if (e.key === "chat_maxOutputTokens" && e.newValue) {
        setMaxOutputTokens(parseInt(e.newValue, 10));
      }
      if (e.key === "chat_enabledServerTools") {
        setEnabledServerTools(getEnabledTools());
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const getIdentityToken = useCallback(async (): Promise<string | null> => {
    return identityToken ?? null;
  }, [identityToken]);

  // Calendar token state (triggers re-render when updated)
  const [calendarToken, setCalendarToken] = useState<string | null>(() =>
    getValidCalendarToken()
  );

  // Drive token state (triggers re-render when updated)
  const [driveToken, setDriveToken] = useState<string | null>(() =>
    getValidDriveToken()
  );

  // Track current message being sent (for OAuth redirect retry)
  const currentMessageRef = useRef<string | null>(null);

  // Check for Calendar token on mount and after OAuth callback
  useEffect(() => {
    const token = getValidCalendarToken();
    if (token && token !== calendarToken) {
      setCalendarToken(token);
    }
  }, [calendarToken]);

  // Check for Drive token on mount and after OAuth callback
  useEffect(() => {
    const token = getValidDriveToken();
    if (token && token !== driveToken) {
      setDriveToken(token);
    }
  }, [driveToken]);

  // Request calendar access - tries to get token or starts OAuth flow
  const requestCalendarAccess = useCallback(async (): Promise<string> => {
    // First, check if we have a valid token
    const validToken = getValidCalendarToken();
    if (validToken) {
      setCalendarToken(validToken);
      return validToken;
    }

    // Try to get token with refresh if needed
    if (hasCalendarCredentials()) {
      const refreshedToken = await getCalendarAccessToken();
      if (refreshedToken) {
        setCalendarToken(refreshedToken);
        return refreshedToken;
      }
    }

    // No valid token - start OAuth flow if client ID is configured
    if (!googleClientId) {
      throw new Error(
        "Google Calendar OAuth not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID."
      );
    }

    // Store the current message so we can retry after OAuth
    if (currentMessageRef.current) {
      storeCalendarPendingMessage(currentMessageRef.current);
    }

    // Start OAuth flow - this will redirect the user
    await startCalendarAuth(googleClientId, "/auth/google/callback");

    // This promise won't resolve since we're redirecting
    // The token will be available after the callback
    return new Promise(() => { });
  }, [calendarToken]);

  // Request Drive access - tries to get token or starts OAuth flow
  const requestDriveAccess = useCallback(async (): Promise<string> => {
    // First, check if we have a valid token
    const validToken = getValidDriveToken();
    if (validToken) {
      setDriveToken(validToken);
      return validToken;
    }

    // Try to get token with refresh if needed
    if (hasDriveCredentials()) {
      const refreshedToken = await getDriveAccessToken();
      if (refreshedToken) {
        setDriveToken(refreshedToken);
        return refreshedToken;
      }
    }

    // No valid token - start OAuth flow if client ID is configured
    if (!googleClientId) {
      throw new Error(
        "Google Drive OAuth not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID."
      );
    }

    // Store the current message so we can retry after OAuth
    if (currentMessageRef.current) {
      storeDrivePendingMessage(currentMessageRef.current);
    }

    // Start OAuth flow - this will redirect the user
    await startDriveAuth(googleClientId, "/auth/google/callback");

    // This promise won't resolve since we're redirecting
    // The token will be available after the callback
    return new Promise(() => { });
  }, [driveToken]);

  // Create Google tools with auth (these are client-side tools with local executors)
  const clientTools = useMemo(() => {
    // Google Calendar tools
    const calendarTools = createChatTools(
      () => calendarToken,
      requestCalendarAccess
    );

    // Google Drive tools (using our custom auth with drive.readonly scope)
    const driveTools = createDriveTools(
      () => driveToken,
      requestDriveAccess
    );

    return [...calendarTools, ...driveTools];
  }, [calendarToken, driveToken, requestCalendarAccess, requestDriveAccess]);

  const baseChatState = useAppChat({
    database,
    model: "openai/gpt-5.2-2025-12-11",
    getToken: getIdentityToken,
    temperature,
    maxOutputTokens,
    walletAddress,
    serverTools: enabledServerTools,
    clientTools,
  });

  // Projects state
  const {
    projects,
    isLoading: projectsLoading,
    isReady: projectsReady,
    inboxProjectId,
    createProject,
    updateProjectName,
    deleteProject,
    getProjectConversations,
    updateConversationProject,
    refreshProjects,
  } = useAppProjects();

  // Track which conversations have been assigned to a project to avoid duplicate/overwriting assignments
  const assignedToProjectRef = useRef<Set<string>>(new Set());
  // Pending project assignment - set this BEFORE creating a conversation to assign it to a specific project
  const pendingProjectAssignmentRef = useRef<string | null>(null);
  // Track the last project that had a conversation assigned (for sidebar refresh)
  const [lastAssignedProjectId, setLastAssignedProjectId] = useState<string | null>(null);
  // Version counter to trigger sidebar refresh when project conversations change
  const [projectConversationsVersion, setProjectConversationsVersion] = useState(0);

  // Mark a conversation as already assigned to a project (prevents auto-inbox assignment)
  const markConversationAssigned = useCallback((conversationId: string) => {
    assignedToProjectRef.current.add(conversationId);
  }, []);

  // Set pending project assignment - call this BEFORE createConversation to assign to a specific project
  const setPendingProjectAssignment = useCallback((projectId: string | null) => {
    pendingProjectAssignmentRef.current = projectId;
  }, []);

  // Trigger a refresh of project conversations in the sidebar
  const triggerProjectConversationsRefresh = useCallback(() => {
    setProjectConversationsVersion(v => v + 1);
  }, []);

  // Automatically assign new conversations to inbox (only if not already assigned)
  useEffect(() => {
    const conversationId = baseChatState.conversationId;

    // Skip if no conversation or already processed
    if (!conversationId || assignedToProjectRef.current.has(conversationId)) {
      return;
    }

    // Check the actual conversation data to see if it already has a projectId
    // This handles conversations created with projectId option (from project page)
    const checkAndAssign = async () => {
      // Mark as processed immediately to prevent duplicate processing
      assignedToProjectRef.current.add(conversationId);

      try {
        // Fetch the conversation to check if it already has a projectId
        const conversation = await baseChatState.getConversation(conversationId);

        // If conversation already has a projectId, it was created from a project page
        // Just trigger a refresh and don't overwrite the assignment
        if (conversation?.projectId) {
          console.log(`[ChatProvider] Conversation ${conversationId} already assigned to project ${conversation.projectId}`);
          setLastAssignedProjectId(conversation.projectId);
          setProjectConversationsVersion(v => v + 1);
          return;
        }

        // Conversation has no projectId, assign to inbox
        const targetProjectId = inboxProjectId;
        if (!targetProjectId) {
          console.log(`[ChatProvider] No inbox project for conversation ${conversationId}`);
          return;
        }

        const success = await updateConversationProject(conversationId, targetProjectId);
        if (success) {
          console.log(`[ChatProvider] Assigned conversation ${conversationId} to inbox ${targetProjectId}`);
          setLastAssignedProjectId(targetProjectId);
          setProjectConversationsVersion(v => v + 1);
        } else {
          // Remove from set if assignment failed so it can be retried
          assignedToProjectRef.current.delete(conversationId);
          console.error(`[ChatProvider] Failed to assign conversation ${conversationId} to inbox`);
        }
      } catch (error) {
        console.error(`[ChatProvider] Error checking/assigning conversation ${conversationId}:`, error);
        // Remove from set so it can be retried
        assignedToProjectRef.current.delete(conversationId);
      }
    };

    checkAndAssign();
  }, [baseChatState.conversationId, baseChatState.getConversation, inboxProjectId, updateConversationProject]);

  // Reload current conversation once when encryption becomes ready on page load
  // This ensures SDK can resolve file placeholders to blob URLs
  const hasReloadedForEncryptionRef = useRef(false);
  useEffect(() => {
    if (
      encryptionReady &&
      baseChatState.conversationId &&
      !hasReloadedForEncryptionRef.current
    ) {
      hasReloadedForEncryptionRef.current = true;
      // Reload the current conversation to resolve file placeholders
      baseChatState.switchConversation(baseChatState.conversationId);
    }
  }, [encryptionReady, baseChatState.conversationId, baseChatState.switchConversation]);

  // Wrap handleSubmit to track the current message for OAuth retry
  const handleSubmit = useCallback(
    async (message: any, options?: any) => {
      // Track the message text for potential OAuth redirect
      if (message?.text) {
        currentMessageRef.current = message.text;
      }
      try {
        await baseChatState.handleSubmit(message, options);
      } finally {
        // Clear after successful send (or error)
        currentMessageRef.current = null;
      }
    },
    [baseChatState]
  );

  // Wrap deleteConversation to trigger sidebar refresh after deletion
  const deleteConversation = useCallback(
    async (id: string) => {
      await baseChatState.deleteConversation(id);
      // Trigger sidebar refresh so deleted conversations disappear
      triggerProjectConversationsRefresh();
    },
    [baseChatState, triggerProjectConversationsRefresh]
  );

  // Check for pending message after OAuth return and auto-retry
  // Store the pending message in a ref so we don't lose it if conditions aren't met yet
  const pendingMessageRef = useRef<string | null>(null);
  const pendingMessageSourceRef = useRef<"calendar" | "drive" | null>(null);
  const pendingMessageHandledRef = useRef(false);

  // Check for pending message on mount (before conditions are ready)
  useEffect(() => {
    if (pendingMessageRef.current === null && !pendingMessageHandledRef.current) {
      // Check for Calendar pending message first
      const calendarMessage = getAndClearCalendarPendingMessage();
      if (calendarMessage) {
        pendingMessageRef.current = calendarMessage;
        pendingMessageSourceRef.current = "calendar";
        return;
      }
      // Check for Drive pending message
      const driveMessage = getAndClearDrivePendingMessage();
      if (driveMessage) {
        pendingMessageRef.current = driveMessage;
        pendingMessageSourceRef.current = "drive";
      }
    }
  }, []);

  // Retry pending message when all conditions are met
  useEffect(() => {
    // Only run once
    if (pendingMessageHandledRef.current) return;

    // Need identity token (Privy session restored)
    if (!identityToken) return;

    // Need wallets to be ready (Privy fully loaded)
    if (!walletsReady) return;

    // Need encryption key to be ready (user may need to sign in Privy modal)
    if (!encryptionReady) return;

    // Need a pending message
    if (!pendingMessageRef.current) return;

    // Check if the required token is available based on the source
    const source = pendingMessageSourceRef.current;
    if (source === "calendar" && !calendarToken) return;
    if (source === "drive" && !driveToken) return;

    const pendingMessage = pendingMessageRef.current;
    pendingMessageRef.current = null;
    pendingMessageSourceRef.current = null;
    pendingMessageHandledRef.current = true;

    console.log("Retrying pending message after OAuth:", pendingMessage, "source:", source);
    // Small delay to ensure everything is initialized
    setTimeout(() => {
      handleSubmit({ text: pendingMessage });
    }, 500);
  }, [calendarToken, driveToken, identityToken, walletsReady, encryptionReady, handleSubmit]);

  const chatState = useMemo(
    () => ({
      ...baseChatState,
      handleSubmit,
      deleteConversation,
      // Projects
      projects,
      projectsLoading,
      projectsReady,
      inboxProjectId,
      lastAssignedProjectId,
      projectConversationsVersion,
      createProject,
      updateProjectName,
      deleteProject,
      getProjectConversations,
      updateConversationProject,
      refreshProjects,
      markConversationAssigned,
      setPendingProjectAssignment,
      triggerProjectConversationsRefresh,
      // Encryption
      encryptionReady,
    }),
    [
      baseChatState,
      handleSubmit,
      deleteConversation,
      projects,
      projectsLoading,
      projectsReady,
      inboxProjectId,
      lastAssignedProjectId,
      projectConversationsVersion,
      createProject,
      updateProjectName,
      deleteProject,
      getProjectConversations,
      updateConversationProject,
      refreshProjects,
      markConversationAssigned,
      setPendingProjectAssignment,
      triggerProjectConversationsRefresh,
      encryptionReady,
    ]
  );

  return (
    <ChatContext.Provider value={chatState}>{children}</ChatContext.Provider>
  );
}
