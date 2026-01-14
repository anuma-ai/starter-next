"use client";

import {
  useEffect,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import type { Database } from "@nozbe/watermelondb";
import { getDatabase } from "@/lib/database";
import { BackupAuthProvider as SDKBackupAuthProvider } from "@reverbia/sdk/react";

type Props = {
  children: ReactNode;
};

const DatabaseContext = createContext<Database | null>(null);

export function useDatabase(): Database {
  const database = useContext(DatabaseContext);
  if (!database) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return database;
}

export function DatabaseProvider({ children }: Props) {
  const [database, setDatabase] = useState<Database | null>(null);

  useEffect(() => {
    setDatabase(getDatabase());
  }, []);

  if (!database) {
    return null;
  }

  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
}

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyClientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;
const privyTestMode = process.env.NEXT_PUBLIC_PRIVY_TEST_MODE === "true";

export function PrivyAuthProvider({ children }: Props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <>{children}</>;
  }

  if (!privyAppId) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Privy is not configured. Set NEXT_PUBLIC_PRIVY_APP_ID to enable auth."
      );
    }

    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      clientId={privyClientId}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        ...(privyTestMode && {
          // Enable test mode for E2E testing - use OTP "000000" to authenticate
          loginMethods: ["email"],
        }),
      }}
    >
      {children}
    </PrivyProvider>
  );
}

// Google auth is now handled directly in chat-provider.tsx and apps/page.tsx
// using our custom OAuth implementation that requests proper scopes
export function GoogleAuthProvider({ children }: Props) {
  return <>{children}</>;
}

const dropboxAppKey = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function BackupAuthProviderInner({ children }: Props) {
  // Note: We intentionally don't pass walletAddress here because:
  // 1. The encryption key is stored in-memory and lost on OAuth redirects
  // 2. This would cause errors when the provider tries to encrypt tokens
  // 3. OAuth tokens will be stored in sessionStorage (unencrypted but temporary)
  // 4. The actual backup data is still encrypted by our exportConversation function
  return (
    <SDKBackupAuthProvider
      dropboxAppKey={dropboxAppKey}
      dropboxCallbackPath="/auth/dropbox/callback"
      googleClientId={googleClientId}
      googleCallbackPath="/auth/google/callback"
    >
      {children}
    </SDKBackupAuthProvider>
  );
}

export function BackupAuthProvider({ children }: Props) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <>{children}</>;
  }

  return <BackupAuthProviderInner>{children}</BackupAuthProviderInner>;
}
