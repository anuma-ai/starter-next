# Function: useAppOCR()

> **useAppOCR**(): `object`

Defined in: [hooks/useAppOCR.ts:26](https://github.com/anuma-ai/starter-next/blob/dc20dc027963731350a4524090e9b5e065a28364/hooks/useAppOCR.ts#L26)

## Returns

`object`

### clearHistory()

> **clearHistory**: () => `void`

#### Returns

`void`

### error

> **error**: `Error` \| `null`

### extractedTexts

> **extractedTexts**: `ExtractedOCR`[]

### extractFromAnyFiles()

> **extractFromAnyFiles**: (`files`) => `Promise`\<`string` \| `null`\>

#### Parameters

##### files

`FileAttachment`[]

#### Returns

`Promise`\<`string` \| `null`\>

### extractFromImages()

> **extractFromImages**: (`files`) => `Promise`\<`string` \| `null`\>

#### Parameters

##### files

`FileAttachment`[]

#### Returns

`Promise`\<`string` \| `null`\>

### isProcessing

> **isProcessing**: `boolean`
