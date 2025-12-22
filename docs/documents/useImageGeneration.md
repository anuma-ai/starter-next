# Generating Images

The `useImageGeneration` hook from `@reverbia/sdk/react` provides AI image
generation capabilities. It supports multiple models (like DALL-E 3) and returns
generated image URLs or base64-encoded data.

## Prerequisites

- An authentication function that returns a valid token
- Optional: A custom base URL for the API

## Hook Initialization

```ts
const { generateImage, isLoading } = useImageGeneration({
  getToken,
  baseUrl: baseUrl || process.env.NEXT_PUBLIC_API_URL,
});
```

## Generating Images

```ts
const createImage = useCallback(
  async (
    prompt: string,
    options?: {
      model?: string;
      responseFormat?: "url" | "b64_json";
    }
  ) => {
    const model = options?.model || "openai-dall-e-3";
    const responseFormat = options?.responseFormat || "url";

    const result = await generateImage({
      prompt,
      model,
      response_format: responseFormat,
    });

    if (result.data?.images?.[0]?.url) {
      const newImage: GeneratedImage = {
        url: result.data.images[0].url,
        prompt,
        timestamp: Date.now(),
      };

      setGeneratedImages((prev) => [newImage, ...prev]);
      return newImage;
    }

    return null;
  },
  [generateImage]
);
```
