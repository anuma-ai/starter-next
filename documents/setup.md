# Setup

Most hooks require a WatermelonDB database, an auth token, and optionally
wallet credentials for encrypted file storage. This page shows how to obtain
each value.

## Database

`database` is a WatermelonDB instance created with `useDatabaseManager` from
the SDK. It's scoped to the user's wallet address so each user gets their own
local store. Expose it via React context so hooks can access it with
`useDatabase()`.

{@includeCode ../lib/chat-setup.ts#database}

## Authentication

`getToken` returns a Privy identity token. It caches the token from
`useIdentityToken()` and refreshes it when the JWT expires, avoiding redundant
API calls to `/api/v1/users/me`.

{@includeCode ../lib/chat-setup.ts#getToken}

## Wallet and Signing

`walletAddress` and the signing functions come from Privy's auth hooks.
`signMessage` prompts the user to sign (used to derive an encryption key for
file storage in OPFS), while `embeddedWalletSigner` signs silently via Privy's
embedded wallet.

{@includeCode ../lib/chat-setup.ts#walletSetup}
