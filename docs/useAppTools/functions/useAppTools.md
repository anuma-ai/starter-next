# Function: useAppTools()

> **useAppTools**(`__namedParameters`): `object`

Defined in: [hooks/useAppTools.ts:173](https://github.com/anuma-ai/starter-next/blob/main/hooks/useAppTools.ts#L173)

useAppTools Hook

Wraps the SDK's useTools hook and adds local tool modes management
via localStorage.

## Parameters

### \_\_namedParameters

`UseToolsProps`

## Returns

`object`

### checkForUpdates()

> **checkForUpdates**: (`responseChecksum`) => `boolean`

#### Parameters

##### responseChecksum

`string` | `undefined`

#### Returns

`boolean`

### checksum

> **checksum**: `string` \| `undefined`

### enabledTools

> **enabledTools**: `string`[]

### error

> **error**: `Error` \| `null`

### getMode()

> **getMode**: (`toolName`) => [`ToolMode`](../type-aliases/ToolMode.md)

#### Parameters

##### toolName

`string`

#### Returns

[`ToolMode`](../type-aliases/ToolMode.md)

### isLoading

> **isLoading**: `boolean`

### refetch()

> **refetch**: (`force?`) => `Promise`\<`void`\> = `refresh`

#### Parameters

##### force?

`boolean`

#### Returns

`Promise`\<`void`\>

### semanticSearchEnabled

> **semanticSearchEnabled**: `boolean`

### setToolMode()

> **setToolMode**: (`toolName`, `mode`) => `void`

#### Parameters

##### toolName

`string`

##### mode

[`ToolMode`](../type-aliases/ToolMode.md)

#### Returns

`void`

### toggleSemanticSearch()

> **toggleSemanticSearch**: (`enabled`) => `void`

#### Parameters

##### enabled

`boolean`

#### Returns

`void`

### toolModes

> **toolModes**: [`ToolModes`](../type-aliases/ToolModes.md)

### tools

> **tools**: [`Tool`](../type-aliases/Tool.md)[]
