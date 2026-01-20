"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";
import { useAppTools, type ToolParameter } from "@/hooks/useAppTools";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

/**
 * Get the effective type of a parameter, handling anyOf unions
 */
function getEffectiveType(param: ToolParameter): string {
  if (param.type) return param.type;
  if (param.anyOf) {
    const types = param.anyOf.map((t) => t.type).filter((t) => t !== "null");
    return types[0] || "any";
  }
  return "any";
}

/**
 * Get pastel color classes based on parameter type (macOS-inspired)
 */
function getTypeColorClasses(type: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (type) {
    case "string":
      return {
        bg: "bg-emerald-100 dark:bg-emerald-900/50",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-700",
      };
    case "boolean":
      return {
        bg: "bg-rose-100 dark:bg-rose-900/50",
        text: "text-rose-700 dark:text-rose-300",
        border: "border-rose-200 dark:border-rose-700",
      };
    case "number":
    case "integer":
      return {
        bg: "bg-blue-100 dark:bg-blue-900/50",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-700",
      };
    case "array":
      return {
        bg: "bg-purple-100 dark:bg-purple-900/50",
        text: "text-purple-700 dark:text-purple-300",
        border: "border-purple-200 dark:border-purple-700",
      };
    case "object":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/50",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-700",
      };
    default:
      return {
        bg: "bg-gray-100 dark:bg-gray-800/50",
        text: "text-gray-700 dark:text-gray-300",
        border: "border-gray-200 dark:border-gray-600",
      };
  }
}

/**
 * Parameter badge component with tooltip
 */
function ParameterBadge({
  name,
  param,
  isRequired,
}: {
  name: string;
  param: ToolParameter;
  isRequired: boolean;
}) {
  const effectiveType = getEffectiveType(param);
  const colors = getTypeColorClasses(effectiveType);

  // Build tooltip content
  const tooltipLines: string[] = [];

  if (param.description) {
    tooltipLines.push(param.description);
  }

  tooltipLines.push(`Type: ${effectiveType}`);

  if (param.enum && param.enum.length > 0) {
    tooltipLines.push(`Options: ${param.enum.join(", ")}`);
  }

  if (param.default !== undefined) {
    tooltipLines.push(`Default: ${JSON.stringify(param.default)}`);
  }

  if (param.minimum !== undefined || param.maximum !== undefined) {
    const range = [];
    if (param.minimum !== undefined) range.push(`min: ${param.minimum}`);
    if (param.maximum !== undefined) range.push(`max: ${param.maximum}`);
    tooltipLines.push(`Range: ${range.join(", ")}`);
  }

  if (param.minLength !== undefined || param.maxLength !== undefined) {
    const length = [];
    if (param.minLength !== undefined) length.push(`min: ${param.minLength}`);
    if (param.maxLength !== undefined) length.push(`max: ${param.maxLength}`);
    tooltipLines.push(`Length: ${length.join(", ")}`);
  }

  if (param.format) {
    tooltipLines.push(`Format: ${param.format}`);
  }

  tooltipLines.push(isRequired ? "Required" : "Optional");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium cursor-default transition-colors border ${colors.bg} ${colors.text} ${isRequired ? colors.border : "border-transparent opacity-70"}`}
        >
          {name}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs text-left whitespace-pre-line"
      >
        {tooltipLines.join("\n")}
      </TooltipContent>
    </Tooltip>
  );
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
                const properties = tool.parameters?.properties || {};
                const required = tool.parameters?.required || [];
                const paramNames = Object.keys(properties);

                // Sort parameters: required first, then optional
                const sortedParams = [...paramNames].sort((a, b) => {
                  const aRequired = required.includes(a);
                  const bRequired = required.includes(b);
                  if (aRequired && !bRequired) return -1;
                  if (!aRequired && bRequired) return 1;
                  return 0;
                });

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
                      <p className="text-sm font-medium">
                        {formatToolName(tool.name)}
                      </p>
                      {tool.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
                          {tool.description}
                        </p>
                      )}
                      {sortedParams.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {sortedParams.map((paramName) => (
                            <ParameterBadge
                              key={paramName}
                              name={paramName}
                              param={properties[paramName]}
                              isRequired={required.includes(paramName)}
                            />
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
