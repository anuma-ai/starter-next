"use client";

import { useEffect } from "react";
import { useModels as useSDKModels } from "@reverbia/sdk/react";

/**
 * useModels Hook Example
 *
 * The useModels hook fetches and manages the list of available LLM models
 * from the API. It provides model metadata and supports refreshing the list.
 */

type UseModelsProps = {
  getToken: () => Promise<string | null>;
  baseUrl?: string;
};

export function useModels({ getToken, baseUrl }: UseModelsProps) {
  const { models, refetch, isLoading, error } = useSDKModels({
    getToken,
    baseUrl: baseUrl || process.env.NEXT_PUBLIC_API_URL,
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  const getModelDisplayName = (modelId: string) => {
    if (modelId.includes("/")) {
      return modelId.split("/").pop() || modelId;
    }
    return modelId;
  };

  const getModelsByProvider = () => {
    const grouped: Record<string, typeof models> = {};

    models?.forEach((model: any) => {
      const provider = model.id.split("/")[0] || "other";
      if (!grouped[provider]) {
        grouped[provider] = [];
      }
      grouped[provider].push(model);
    });

    return grouped;
  };

  return {
    models: models || [],
    isLoading,
    error,
    refetch,
    getModelDisplayName,
    getModelsByProvider,
  };
}
