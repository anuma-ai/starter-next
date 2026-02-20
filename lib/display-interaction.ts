/**
 * Display interaction helpers.
 *
 * Display tool results (charts, weather cards) are persisted as part of the
 * conversation messages. These helpers extract, anchor, persist and restore
 * display results so the chatbot can render visual components inline.
 */

import { useEffect, useRef } from "react";

export type ParsedDisplayResult = {
  displayType: string;
  result: any;
};

/**
 * A display interaction anchored to a message position.
 */
export type DisplayInteraction = {
  id: string;
  displayType: string;
  result: any;
  /** The message ID this display appears after */
  afterMessageId?: string;
};

/**
 * Extract display tool results embedded in a [Tool Execution Results] message.
 *
 * The message format is:
 *   [Tool Execution Results]
 *   Tool "display_chart" returned: { ... JSON ... }
 *   Based on these results, continue with the task.
 */
export function parseDisplayResults(text: string): ParsedDisplayResult[] {
  const results: ParsedDisplayResult[] = [];
  const regex = /Tool "display_(\w+)" returned: (.+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      results.push({
        displayType: match[1],
        result: JSON.parse(match[2]),
      });
    } catch {
      // Skip malformed JSON
    }
  }
  return results;
}

// #region collectDisplayInteractions
/**
 * Scan all messages and collect display interactions with their anchor
 * positions.  Returns a flat list of DisplayInteraction objects and a Set
 * you can use to track which ones have already been rendered inline.
 */
export function collectDisplayInteractions(
  messages: Array<{ id: string; role: string; parts?: Array<{ type: string; text?: string }> }>
): { displays: DisplayInteraction[]; renderedIds: Set<string> } {
  const displays: DisplayInteraction[] = [];

  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = message.parts?.[0]?.text;
    if (!text?.includes("[Tool Execution Results]")) continue;

    const parsed = parseDisplayResults(text);
    for (const p of parsed) {
      displays.push({
        id: `${message.id}-${p.displayType}`,
        displayType: p.displayType,
        result: p.result,
        afterMessageId: message.id,
      });
    }
  }

  return { displays, renderedIds: new Set<string>() };
}
// #endregion collectDisplayInteractions

// #region getDisplaysForMessage
/**
 * Get display interactions that should render before a given message.
 * Marks returned interactions as rendered so they are not duplicated.
 */
export function getDisplaysForMessage(
  messageId: string,
  displays: DisplayInteraction[],
  renderedIds: Set<string>
): DisplayInteraction[] {
  const matching = displays.filter(
    (d) => d.afterMessageId === messageId && !renderedIds.has(d.id)
  );
  for (const d of matching) {
    renderedIds.add(d.id);
  }
  return matching;
}
// #endregion getDisplaysForMessage

// #region getUnanchoredDisplays
/**
 * Get display interactions whose anchor message is not present in the
 * current message list.  These are rendered at the bottom of the chat as a
 * fallback (e.g. after a page refresh before messages finish loading).
 */
export function getUnanchoredDisplays(
  displays: DisplayInteraction[],
  messageIds: Set<string>,
  renderedIds: Set<string>
): DisplayInteraction[] {
  return displays.filter((d) => {
    if (renderedIds.has(d.id)) return false;
    if (!d.afterMessageId) return true;
    return !messageIds.has(d.afterMessageId);
  });
}
// #endregion getUnanchoredDisplays

// #region useDisplayPersistence
type StoredInteraction = {
  displayType: string;
  result: any;
  messageIndex: number;
};

/**
 * Persist display interactions to localStorage so they survive page
 * refreshes.  Message IDs are ephemeral, so the hook stores the message
 * index instead and re-maps to the current ID list on restore.
 */
export function useDisplayPersistence(
  conversationId: string | undefined,
  messages: Array<{ id: string }>,
  displays: DisplayInteraction[]
) {
  const prevCountRef = useRef(0);

  // Save when new display interactions appear
  useEffect(() => {
    if (!conversationId || displays.length === 0) return;
    if (displays.length === prevCountRef.current) return;
    prevCountRef.current = displays.length;

    const stored: StoredInteraction[] = displays.map((d) => {
      const idx = messages.findIndex((m) => m.id === d.afterMessageId);
      return {
        displayType: d.displayType,
        result: d.result,
        messageIndex: idx,
      };
    });

    localStorage.setItem(
      `display_interactions_${conversationId}`,
      JSON.stringify(stored)
    );
  }, [conversationId, displays, messages]);

  // Restore on conversation load
  useEffect(() => {
    if (!conversationId || messages.length === 0) return;

    const raw = localStorage.getItem(
      `display_interactions_${conversationId}`
    );
    if (!raw) return;

    try {
      const stored: StoredInteraction[] = JSON.parse(raw);
      const restored: DisplayInteraction[] = stored
        .filter((s) => s.messageIndex >= 0 && s.messageIndex < messages.length)
        .map((s, i) => ({
          id: `restored-${i}`,
          displayType: s.displayType,
          result: s.result,
          afterMessageId: messages[s.messageIndex]?.id,
        }));

      if (restored.length > 0) {
        prevCountRef.current = restored.length;
      }
    } catch {
      // Ignore corrupt data
    }
  }, [conversationId, messages]);
}
// #endregion useDisplayPersistence
