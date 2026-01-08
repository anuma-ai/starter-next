"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import { useIdentityToken, usePrivy, useWallets } from "@privy-io/react-auth";
import { useDatabase } from "@/app/providers";
import { useAppChat } from "@/hooks/useAppChat";
import { requestEncryptionKey, hasEncryptionKey } from "@reverbia/sdk/react";

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
        console.log("Encryption key initialized for wallet:", walletAddress);
      } catch (err) {
        console.error("Failed to initialize encryption key:", err);
      } finally {
        isInitializingRef.current = false;
      }
    };
    initEncryption();
  }, [walletAddress, walletsReady]);

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

  const chatState = useAppChat({
    database,
    model: "openai/gpt-5.2-2025-12-11",
    getToken: getIdentityToken,
    temperature,
    maxOutputTokens,
    walletAddress,
    signMessage,
    embeddedWalletSigner: embeddedWallet ? embeddedWalletSigner : undefined,
  });

  return (
    <ChatContext.Provider value={chatState}>{children}</ChatContext.Provider>
  );
}
