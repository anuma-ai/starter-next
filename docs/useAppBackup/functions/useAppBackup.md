# Function: useAppBackup()

> **useAppBackup**(): `object`

Defined in: [hooks/useAppBackup.ts:43](https://github.com/anuma-ai/starter-next/blob/dc20dc027963731350a4524090e9b5e065a28364/hooks/useAppBackup.ts#L43)

Hook that provides backup functionality with export/import capabilities.
Uses the SDK's useBackup hook with custom export/import implementations.

## Returns

### disconnectAll()

> **disconnectAll**: () => `Promise`\<`void`\>

Disconnect from all providers

#### Returns

`Promise`\<`void`\>

### dropbox

> **dropbox**: `ProviderBackupState`

Dropbox backup state and methods

### googleDrive

> **googleDrive**: `ProviderBackupState`

Google Drive backup state and methods

### hasAnyAuthentication

> **hasAnyAuthentication**: `boolean`

Whether any backup provider is authenticated

### hasAnyProvider

> **hasAnyProvider**: `boolean`

Whether any backup provider is configured

### icloud

> **icloud**: `ProviderBackupState`

iCloud backup state and methods

### initializeEncryption()

> **initializeEncryption**: () => `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

### isEncryptionReady

> **isEncryptionReady**: `boolean`

### isInitializingEncryption

> **isInitializingEncryption**: `boolean`

### isReady

> **isReady**: `boolean`

### walletAddress

> **walletAddress**: `string` \| `null`
