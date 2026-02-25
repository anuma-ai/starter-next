# Function: useAppModels()

> **useAppModels**(`__namedParameters`): `object`

Defined in: [hooks/useAppModels.ts:18](https://github.com/anuma-ai/starter-next/blob/dc20dc027963731350a4524090e9b5e065a28364/hooks/useAppModels.ts#L18)

## Parameters

### \_\_namedParameters

`UseModelsProps`

## Returns

`object`

### error

> **error**: `Error` \| `null`

### getModelDisplayName()

> **getModelDisplayName**: (`modelId`) => `string`

#### Parameters

##### modelId

`string`

#### Returns

`string`

### getModelsByProvider()

> **getModelsByProvider**: () => `Record`\<`string`, `LlmapiModel`[]\>

#### Returns

`Record`\<`string`, `LlmapiModel`[]\>

### isLoading

> **isLoading**: `boolean`

### models

> **models**: `LlmapiModel`[]

### refetch()

> **refetch**: () => `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
