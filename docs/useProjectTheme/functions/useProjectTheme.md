# Function: useProjectTheme()

> **useProjectTheme**(`projectId`): `object`

Defined in: [hooks/useProjectTheme.ts:18](https://github.com/anuma-ai/starter-next/blob/dc20dc027963731350a4524090e9b5e065a28364/hooks/useProjectTheme.ts#L18)

React hook for managing project-level theme settings
Uses synchronous reads during render to prevent flash of wrong theme

## Parameters

### projectId

The project ID to manage themes for (null if no project)

`string` | `null`

## Returns

Theme settings and update functions

### clearTheme()

> **clearTheme**: () => `void`

Clear all theme overrides for this project

#### Returns

`void`

### hasColorOverride

> **hasColorOverride**: `boolean`

### hasIconOverride

> **hasIconOverride**: `boolean`

### hasProjectIcon

> **hasProjectIcon**: `boolean`

### loadedForProjectId

> **loadedForProjectId**: `string` \| `null` = `loadedProjectIdRef.current`

### settings

> **settings**: `ProjectThemeSettings`

### settingsLoaded

> **settingsLoaded**: `boolean`

### updateColorTheme()

> **updateColorTheme**: (`colorTheme`) => `void`

Update the color theme for this project

#### Parameters

##### colorTheme

Theme ID or undefined to inherit from global

`string` | `undefined`

#### Returns

`void`

### updateIconTheme()

> **updateIconTheme**: (`iconTheme`) => `void`

Update the icon theme (background pattern) for this project

#### Parameters

##### iconTheme

Icon theme ID or undefined to inherit from global

`string` | `undefined`

#### Returns

`void`

### updateProjectIcon()

> **updateProjectIcon**: (`projectIcon`) => `void`

Update the project icon (openmoji hexcode)

#### Parameters

##### projectIcon

Openmoji hexcode or undefined to remove

`string` | `undefined`

#### Returns

`void`
