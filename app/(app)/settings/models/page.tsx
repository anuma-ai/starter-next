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
    <div className="flex flex-1 flex-col p-8 pt-16 md:pt-8 bg-sidebar dark:bg-background border-l border-border dark:border-l-0">
      <div className="mx-auto w-full max-w-2xl pb-8">
        <div className="mb-6 flex items-center h-8 relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/settings")}
            className="absolute left-0 top-1/2 -translate-y-1/2"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold w-full text-center">Models</h1>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-muted-foreground">Loading models...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-destructive">
                Failed to load models: {error.message}
              </p>
            </div>
          ) : models.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-muted-foreground">No models available.</p>
            </div>
          ) : (
            <div className="rounded-xl bg-white dark:bg-card p-1">
              {models.map((model, index) => {
                const pricing = model.pricing as { prompt?: string; completion?: string } | undefined;
                const modalities = model.modalities as string[] | undefined;

                return (
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
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {modalities?.map((modality) => (
                        <span
                          key={modality}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {modality}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {model.owned_by && <span>{model.owned_by}</span>}
                      {model.context_length && (
                        <span>{model.owned_by ? " · " : ""}{(model.context_length / 1000).toFixed(0)}k context</span>
                      )}
                      {pricing?.prompt && (
                        <span>
                          {(model.owned_by || model.context_length) ? " · " : ""}
                          ${parseFloat(pricing.prompt).toFixed(6)}/1k input
                        </span>
                      )}
                      {pricing?.completion && (
                        <span> · ${parseFloat(pricing.completion).toFixed(6)}/1k output</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
