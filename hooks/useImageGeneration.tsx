"use client";

import { useState, useCallback } from "react";
import { useImageGeneration as useSDKImageGeneration } from "@reverbia/sdk/react";

/**
 * useImageGeneration Hook Example
 *
 * The useImageGeneration hook provides AI image generation capabilities.
 * It supports multiple models (like DALL-E 3) and returns generated image URLs.
 */

type UseImageGenerationProps = {
  getToken: () => Promise<string | null>;
  baseUrl?: string;
};

type GeneratedImage = {
  url: string;
  prompt: string;
  timestamp: number;
};

export function useImageGeneration({
  getToken,
  baseUrl,
}: UseImageGenerationProps) {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  const { generateImage, isLoading, error } = useSDKImageGeneration({
    getToken,
    baseUrl: baseUrl || process.env.NEXT_PUBLIC_API_URL,
  });

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

  const clearHistory = useCallback(() => {
    setGeneratedImages([]);
  }, []);

  return {
    createImage,
    generatedImages,
    isLoading,
    error,
    clearHistory,
  };
}
