/**
 * Setup helpers for useChatStorage.
 *
 * These snippets show how to obtain the values that useChatStorage expects.
 * The actual implementations live in chat-provider.tsx and providers.tsx —
 * this file exists so the auto-generated docs can reference real code via
 * TypeDoc's @includeCode regions (which don't support .tsx files).
 */

import { useCallback, useRef, useEffect } from "react";
import {
  useIdentityToken,
  getIdentityToken as fetchIdentityToken,
} from "@privy-io/react-auth";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useDatabaseManager } from "@reverbia/sdk/react";
import { dbManager } from "@/lib/database";

// #region database
// Create a WatermelonDB instance scoped to the user's wallet address.
// Expose via React context so hooks can access it with useDatabase().
export function setupDatabase() {
  const { user } = usePrivy();
  const database = useDatabaseManager(user?.wallet?.address, dbManager);
  return database;
}
// #endregion database

// #region getToken
// Cache the Privy identity token and refresh when the JWT expires.
// This avoids calling Privy's standalone getIdentityToken() on every
// request (which hits /api/v1/users/me each time).
export function setupGetToken() {
  const { identityToken } = useIdentityToken();
  const identityTokenRef = useRef(identityToken);
  const tokenWaitersRef = useRef<Array<(token: string | null) => void>>([]);

  useEffect(() => {
    identityTokenRef.current = identityToken;
    if (identityToken && tokenWaitersRef.current.length > 0) {
      for (const resolve of tokenWaitersRef.current) resolve(identityToken);
      tokenWaitersRef.current = [];
    }
  }, [identityToken]);

  const getToken = useCallback(async (): Promise<string | null> => {
    const cached = identityTokenRef.current;
    if (cached) {
      try {
        const payload = JSON.parse(atob(cached.split(".")[1]));
        if (payload.exp && payload.exp * 1000 > Date.now() + 30_000) {
          return cached;
        }
      } catch {
        // Fall through to refresh
      }
      try {
        const fresh = await fetchIdentityToken();
        if (fresh) {
          identityTokenRef.current = fresh;
          return fresh;
        }
      } catch {
        // Network error — fall through to waiter
      }
    }
    return new Promise((resolve) => {
      tokenWaitersRef.current.push(resolve);
      setTimeout(() => {
        tokenWaitersRef.current = tokenWaitersRef.current.filter(
          (r) => r !== resolve
        );
        resolve(identityTokenRef.current);
      }, 10_000);
    });
  }, []);

  return getToken;
}
// #endregion getToken

// #region walletSetup
// Get wallet address and signing functions from Privy.
// signMessage prompts the user; embeddedWalletSigner signs silently.
export function setupWallet() {
  const { user, signMessage: privySignMessage } = usePrivy();
  const { wallets } = useWallets();

  const walletAddress = user?.wallet?.address;

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

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const embeddedWalletSigner = useCallback(
    async (message: string) => {
      if (!embeddedWallet?.address) throw new Error("Embedded wallet not ready");
      const result = await privySignMessage(
        { message },
        { uiOptions: { showWalletUIs: false } }
      );
      return result.signature;
    },
    [embeddedWallet, privySignMessage]
  );

  return { walletAddress, signMessage, embeddedWalletSigner };
}
// #endregion walletSetup
