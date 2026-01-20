"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";
import { useAppTools } from "@/hooks/useAppTools";

/**
 * Convert tool name to human readable format
 * e.g., "Ask_Solana_Anchor_Framework_Expert" -> "Ask Solana Anchor Framework Expert"
 * e.g., "unlock_blockchain_analysis" -> "Unlock Blockchain Analysis"
 */
function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ToolsPage() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const { identityToken } = useIdentityToken();

  const getToken = useCallback(async () => {
    return identityToken ?? null;
  }, [identityToken]);

  const { tools, enabledTools, isLoading, error, refetch, toggleTool } =
    useAppTools({
      getToken,
      baseUrl: process.env.NEXT_PUBLIC_API_URL,
    });

  useEffect(() => {
    if (authenticated && identityToken) {
      refetch();
    }
  }, [authenticated, identityToken, refetch]);

  return (
    <div className="flex flex-1 flex-col p-8 pt-16 md:pt-8 bg-sidebar dark:bg-background border-l border-border dark:border-0">
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
          <h1 className="text-lg font-semibold w-full text-center">
            Server-Side Tools
          </h1>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Enable tools to extend the AI assistant&apos;s capabilities. Enabled
          tools will be available when sending messages.
        </p>

        <div className="space-y-4">
          {isLoading ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-muted-foreground">Loading tools...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-destructive">
                Failed to load tools: {error.message}
              </p>
            </div>
          ) : tools.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-muted-foreground">
                No tools available.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-white dark:bg-card p-1">
              {tools.map((tool, index) => {
                const isEnabled = enabledTools.includes(tool.name);

                return (
                  <div
                    key={tool.name}
                    className={`flex items-start justify-between px-4 py-3 ${
                      index < tools.length - 1
                        ? "border-b border-border/50"
                        : ""
                    }`}
                  >
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-medium">{formatToolName(tool.name)}</p>
                      {tool.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
                          {tool.description}
                        </p>
                      )}
                      {tool.parameters?.required &&
                        tool.parameters.required.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tool.parameters.required.map((param) => (
                              <span
                                key={param}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                              >
                                {param}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => toggleTool(tool.name)}
                    />
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
