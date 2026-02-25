# Cloud Backup

The `useAppBackup` hook provides encrypted backup and restore of conversations
to cloud storage providers (Google Drive, Dropbox). Conversations are exported
as encrypted JSON blobs, uploaded via the SDK's `useBackup` hook, and can be
imported back with automatic decryption and deduplication.

## Prerequisites

- A WatermelonDB `Database` instance configured in your app
- Privy authentication with an embedded wallet (for encryption key derivation)

## Hook Initialization

The hook connects to Privy for wallet access, initializes encryption, and
wires up the SDK's `useBackup` with custom export/import implementations:

{@includeCode ../hooks/useAppBackup.ts#hookInit}

## Exporting Conversations

Export serializes a conversation and all its messages into a JSON structure,
encrypts it using the user's wallet-derived key, and returns a `Blob` ready
for upload:

{@includeCode ../hooks/useAppBackup.ts#exportConversation}

The encryption uses `encryptData` from the SDK, which derives a symmetric key
from the user's wallet address.

## Importing Conversations

Import decrypts a blob, validates the data version, and restores the
conversation and messages to the local database. It handles several edge
cases: skipping conversations that already exist, restoring soft-deleted
conversations, and avoiding duplicate message insertion.

{@includeCode ../hooks/useAppBackup.ts#importConversation}

## Connecting to Cloud Providers

The SDK's `useBackup` hook handles the actual cloud provider integration. Pass
it the export/import functions along with the user's wallet address and an
encryption key request handler:

{@includeCode ../hooks/useAppBackup.ts#backupHook}

The returned `backup` object from the SDK exposes methods for connecting to
Google Drive or Dropbox, listing remote backups, uploading, and downloading.

## Return Value

The hook spreads the SDK's backup methods and adds encryption and wallet
state:

{@includeCode ../hooks/useAppBackup.ts#returnValue}

Call `initializeEncryption()` before connecting to a backup provider — it
derives the encryption key from the user's wallet, which may prompt a
signature.
