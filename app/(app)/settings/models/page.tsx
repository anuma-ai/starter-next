"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useModels } from "@reverbia/sdk/react";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";

export default function ModelsPage() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const { identityToken } = useIdentityToken();

  const getToken = useCallback(async () => {
    return identityToken ?? null;
  }, [identityToken]);

  const { models, isLoading, error, refetch } = useModels({
    getToken,
    baseUrl: process.env.NEXT_PUBLIC_API_URL,
  });

  useEffect(() => {
    if (authenticated && identityToken) {
      refetch();
    }
  }, [authenticated, identityToken, refetch]);

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="mx-auto w-full max-w-2xl pb-8">
        <div className="mb-6 flex items-center h-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings")}
            className="absolute"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold w-full text-center">Models</h1>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-xl bg-background p-4">
              <p className="text-sm text-muted-foreground">Loading models...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-background p-4">
              <p className="text-sm text-destructive">
                Failed to load models: {error.message}
              </p>
            </div>
          ) : models.length === 0 ? (
            <div className="rounded-xl bg-background p-4">
              <p className="text-sm text-muted-foreground">No models available.</p>
            </div>
          ) : (
            <div className="rounded-xl bg-background p-1">
              {models.map((model, index) => (
                <div
                  key={model.id}
                  className={`px-4 py-3 ${
                    index < models.length - 1 ? "border-b border-border/50" : ""
                  }`}
                >
                  <p className="text-sm font-medium">{model.name || model.id}</p>
                  {model.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {model.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {model.owned_by}
                    {model.context_length && ` · ${(model.context_length / 1000).toFixed(0)}k context`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
