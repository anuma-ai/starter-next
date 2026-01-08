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
import { requestEncryptionKey, hasEncryptionKey, useGoogleDriveAuth } from "@reverbia/sdk/react";
import { createChatTools, createDriveTools } from "@reverbia/sdk/tools";
import {
  getValidCalendarToken,
  getCalendarAccessToken,
  startCalendarAuth,
  hasCalendarCredentials,
  storePendingMessage,
  getAndClearPendingMessage,
} from "@/lib/google-calendar-auth";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

type ChatState = {
  messages: any[];
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (message: any, options?: any) => Promise<void>;
  addMessageOptimistically: (text: string, files?: any[], displayText?: string) => string;
  isLoading: boolean;
  status: any;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  subscribeToStreaming: (callback: (text: string) => void) => () => void;
  subscribeToThinking: (callback: (text: string) => void) => () => void;
  conversationId: string | null;
  conversations: any[];
  createConversation: () => Promise<any>;
  setConversationId: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
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
} from "@/lib/google-calendar-auth";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { identityToken } = useIdentityToken();
  const { user, signMessage: privySignMessage, ready: privyReady } = usePrivy();

  // Wrap Privy's signMessage to match SDK's expected signature
  const signMessage = useCallback(
    async (message: string) => {
      const result = await privySignMessage({ message });
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
      const provider = await embeddedWallet.getEthereumProvider();
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts available in embedded wallet");
      }
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, accounts[0]],
      });
      return signature as string;
    },
    [embeddedWallet]
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
        // Use refs to get latest values without dependency issues
        // Only use embedded wallet signer if the wallet exists AND is ready (has address)
        const signer = embeddedWalletRef.current && embeddedWalletReadyRef.current
          ? embeddedWalletSignerRef.current
          : undefined;

        console.log("Initializing encryption key with embedded wallet:", {
          hasEmbeddedWallet: !!embeddedWalletRef.current,
          embeddedWalletReady: embeddedWalletReadyRef.current,
          usingSilentSigning: !!signer,
        });

        await requestEncryptionKey(
          walletAddress,
          signMessageRef.current,
          signer
        );
        encryptionInitializedRef.current = walletAddress;
        setEncryptionReady(true);
        console.log("Encryption key initialized for wallet:", walletAddress);
      } catch (err) {
        console.error("Failed to initialize encryption key:", err);
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
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const getIdentityToken = useCallback(async (): Promise<string | null> => {
    return identityToken ?? null;
  }, [identityToken]);

  // Google Drive auth from SDK
  const {
    accessToken: driveAccessToken,
    requestAccess: requestDriveAccess,
  } = useGoogleDriveAuth();

  // Calendar token state (triggers re-render when updated)
  const [calendarToken, setCalendarToken] = useState<string | null>(() =>
    getValidCalendarToken()
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
      storePendingMessage(currentMessageRef.current);
    }

    // Start OAuth flow - this will redirect the user
    await startCalendarAuth(googleClientId, "/auth/google/callback");

    // This promise won't resolve since we're redirecting
    // The token will be available after the callback
    return new Promise(() => {});
  }, [calendarToken]);

  // Create Google tools with auth
  const tools = useMemo(() => {
    // Google Calendar tools
    const calendarTools = createChatTools(
      () => calendarToken,
      requestCalendarAccess
    );

    // Google Drive tools
    const driveTools = createDriveTools(
      () => driveAccessToken,
      requestDriveAccess
    );

    return [...calendarTools, ...driveTools];
  }, [calendarToken, driveAccessToken, requestCalendarAccess, requestDriveAccess]);

  const baseChatState = useAppChat({
    database,
    model: "openai/gpt-5.2-2025-12-11",
    getToken: getIdentityToken,
    temperature,
    maxOutputTokens,
    walletAddress,
    signMessage,
    embeddedWalletSigner: embeddedWallet ? embeddedWalletSigner : undefined,
    tools,
  });

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

  // Check for pending message after OAuth return and auto-retry
  // Store the pending message in a ref so we don't lose it if conditions aren't met yet
  const pendingMessageRef = useRef<string | null>(null);
  const pendingMessageHandledRef = useRef(false);

  // Check for pending message on mount (before conditions are ready)
  useEffect(() => {
    if (pendingMessageRef.current === null && !pendingMessageHandledRef.current) {
      const message = getAndClearPendingMessage();
      if (message) {
        pendingMessageRef.current = message;
      }
    }
  }, []);

  // Retry pending message when all conditions are met
  useEffect(() => {
    // Only run once
    if (pendingMessageHandledRef.current) return;

    // Need calendar token AND identity token (Privy session restored)
    if (!calendarToken || !identityToken) return;

    // Need wallets to be ready (Privy fully loaded)
    if (!walletsReady) return;

    // Need encryption key to be ready (user may need to sign in Privy modal)
    if (!encryptionReady) return;

    // Need a pending message
    if (!pendingMessageRef.current) return;

    const pendingMessage = pendingMessageRef.current;
    pendingMessageRef.current = null;
    pendingMessageHandledRef.current = true;

    console.log("Retrying pending message after OAuth:", pendingMessage);
    // Small delay to ensure everything is initialized
    setTimeout(() => {
      handleSubmit({ text: pendingMessage });
    }, 500);
  }, [calendarToken, identityToken, walletsReady, encryptionReady, handleSubmit]);

  const chatState = useMemo(
    () => ({
      ...baseChatState,
      handleSubmit,
    }),
    [baseChatState, handleSubmit]
  );

  return (
    <ChatContext.Provider value={chatState}>{children}</ChatContext.Provider>
  );
}
