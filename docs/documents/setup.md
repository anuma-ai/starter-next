# Setup

Most hooks require a WatermelonDB database, an auth token, and optionally
wallet credentials for encrypted file storage. This page shows how to obtain
each value.

## Database

`database` is a WatermelonDB instance created with `useDatabaseManager` from
the SDK. It's scoped to the user's wallet address so each user gets their own
local store. Expose it via React context so hooks can access it with
`useDatabase()`.

```ts
// Create a WatermelonDB instance scoped to the user's wallet address.
// Expose via React context so hooks can access it with useDatabase().
export function setupDatabase() {
  const { user } = usePrivy();
  const database = useDatabaseManager(user?.wallet?.address, dbManager);
  return database;
}
```

## Authentication

`getToken` returns a Privy identity token. It caches the token from
`useIdentityToken()` and refreshes it when the JWT expires, avoiding redundant
API calls to `/api/v1/users/me`.

```ts
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
```

## Wallet and Signing

`walletAddress` and the signing functions come from Privy's auth hooks.
`signMessage` prompts the user to sign (used to derive an encryption key for
file storage in OPFS), while `embeddedWalletSigner` signs silently via Privy's
embedded wallet.

```ts
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
```
