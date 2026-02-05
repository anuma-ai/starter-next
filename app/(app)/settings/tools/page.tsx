"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SearchInput } from "@/components/ui/search-input";
import { usePrivy, useIdentityToken } from "@privy-io/react-auth";
import { useAppTools, type ToolParameter } from "@/hooks/useAppTools";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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
 * Get color classes for parameter badges
 */
function getParamColorClasses(): {
  bg: string;
  text: string;
  border: string;
} {
  return {
    bg: "bg-gray-100 dark:bg-gray-800/50",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-600",
  };
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
  const colors = getParamColorClasses();

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
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <span
          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium cursor-default transition-colors border ${colors.bg} ${colors.text} ${isRequired ? colors.border : "border-transparent opacity-70"}`}
        >
          {name}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        sideOffset={8}
        className="max-w-xs text-left text-xs whitespace-pre-line bg-white text-muted-foreground rounded-lg px-3 py-2 border-0 [box-shadow:0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] dark:[box-shadow:0_4px_16px_rgba(0,0,0,0.25),0_1px_4px_rgba(0,0,0,0.15)] dark:bg-card dark:border dark:border-border"
      >
        {tooltipLines.join("\n")}
      </HoverCardContent>
    </HoverCard>
  );
}

export default function ToolsPage() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const { identityToken } = useIdentityToken();

  const getToken = useCallback(async () => {
    return identityToken ?? null;
  }, [identityToken]);

  const { tools, enabledTools, isLoading, error, checksum, refetch, toggleTool } =
    useAppTools({
      getToken,
      baseUrl: process.env.NEXT_PUBLIC_API_URL,
    });

  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleExpanded = (toolName: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

  useEffect(() => {
    if (authenticated && identityToken) {
      refetch().then(() => {
        setLastFetched(new Date());
      });
    }
  }, [authenticated, identityToken, refetch]);

  const filteredTools = tools.filter((tool) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = formatToolName(tool.name).toLowerCase();
    const description = (tool.description || "").toLowerCase();
    return name.includes(query) || description.includes(query);
  });

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
          <h1 className="text-lg font-semibold w-full text-center">
            Server-Side Tools
          </h1>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Enable tools to extend the AI assistant&apos;s capabilities. Enabled
          tools will be available when sending messages.
        </p>

        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search tools..."
          className="mb-4"
        />

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
          ) : filteredTools.length === 0 ? (
            <div className="rounded-xl bg-white dark:bg-card p-4">
              <p className="text-sm text-muted-foreground">
                No tools match your search.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-white dark:bg-card p-1">
              {filteredTools.map((tool, index) => {
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

                const isExpanded = expandedTools.has(tool.name);
                const hasDetails = tool.description || sortedParams.length > 0;

                return (
                  <div
                    key={tool.name}
                    className={`${
                      index < filteredTools.length - 1
                        ? "border-b border-border/50"
                        : ""
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between px-4 py-3 ${hasDetails ? "cursor-pointer" : ""}`}
                      onClick={() => hasDetails && toggleExpanded(tool.name)}
                    >
                      <div className="flex items-center flex-1 pr-4">
                        <p className="text-sm">
                          {formatToolName(tool.name)}
                        </p>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleTool(tool.name)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div
                      className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="overflow-hidden">
                        {hasDetails && (
                          <div className="px-4 pb-3">
                            {tool.description && (
                              <p className="text-xs text-muted-foreground whitespace-pre-line">
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
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {lastFetched && !isLoading && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Last updated: {lastFetched.toLocaleTimeString()}
            </p>
          )}
          {checksum && !isLoading && (
            <p className="text-xs text-muted-foreground mt-1 text-center font-mono">
              {checksum}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
