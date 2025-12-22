# Generating Images

The `useImageGeneration` hook from `@reverbia/sdk/react` provides AI image
generation capabilities. It supports multiple models (like DALL-E 3) and returns
generated image URLs or base64-encoded data.

## Prerequisites

- An authentication function that returns a valid token
- Optional: A custom base URL for the API

## Hook Initialization

{@includeCode ../hooks/useAppImageGeneration.ts#hookInit}

## Generating Images

{@includeCode ../hooks/useAppImageGeneration.ts#generateImage}
