/**
 * Display interaction helpers for rendering and persisting weather cards
 * and other display-only tool results.
 *
 * These helpers are used by the chatbot component to manage the lifecycle
 * of display interactions created by createDisplayTool.
 */

import { useRef, useEffect } from "react";
import type {
  PendingInteraction,
  UIInteractionContextValue,
} from "@reverbia/sdk/react";

// #region collectDisplayInteractions
// Collect all resolved display interactions from the provider, sorted
// by creation time. Call this once per render to build a stable list,
// then use getDisplaysForMessage to distribute them across the chat.
export function collectDisplayInteractions(
  pendingInteractions: Map<string, PendingInteraction>,
) {
  return Array.from(pendingInteractions.values())
    .filter((i) => i.type === "display" && i.resolved)
    .sort((a, b) => a.createdAt - b.createdAt);
}
// #endregion collectDisplayInteractions

// #region getDisplaysForMessage
// Find display interactions anchored to a specific message. Each
// interaction is anchored to the message that was last in the chat
// when the tool was called (via afterMessageId). Marks matched
// interactions as rendered to prevent duplicates.
export function getDisplaysForMessage(
  messageId: string,
  displayInteractions: PendingInteraction[],
  renderedIds: Set<string>,
): PendingInteraction[] {
  const displays = displayInteractions.filter(
    (i) => !renderedIds.has(i.id) && i.data.afterMessageId === messageId,
  );
  displays.forEach((i) => renderedIds.add(i.id));
  return displays;
}
// #endregion getDisplaysForMessage

// #region getUnanchoredDisplays
// Find resolved display interactions whose anchor message isn't in
// the current message list. This happens after a page refresh when
// messages haven't fully loaded, or if the anchor was removed. Render
// these at the bottom of the chat as a fallback.
export function getUnanchoredDisplays(
  pendingInteractions: Map<string, PendingInteraction>,
  messages: { id: string }[],
): PendingInteraction[] {
  return Array.from(pendingInteractions.values())
    .filter((i) => i.type === "display" && i.resolved)
    .filter((i) => {
      const anchorId = i.data.afterMessageId;
      if (!anchorId) return true;
      return !messages.some((m) => m.id === anchorId);
    });
}
// #endregion getUnanchoredDisplays

// #region restoreDisplayInteractions
// Restore display interactions from localStorage for the given
// conversation. Called after clearing interactions on conversation
// switch to immediately repopulate display results.
export function restoreDisplayInteractions(
  uiInteraction: UIInteractionContextValue,
  conversationId: string,
  messages: { id: string }[],
) {
  try {
    const stored = localStorage.getItem(`display:${conversationId}`);
    console.log(`[DISPLAY-DEBUG] restoreDisplayInteractions: convId=${conversationId}, localStorage has data=${!!stored}, messages.length=${messages.length}`);
    if (!stored) return;
    const items = JSON.parse(stored);
    let created = 0;
    let skipped = 0;
    for (const item of items) {
      const exists = uiInteraction.getInteraction(item.id);
      if (exists) { skipped++; continue; }
      const anchorMsg =
        item.anchorMessageIndex != null
          ? messages[item.anchorMessageIndex]
          : undefined;
      console.log(`[DISPLAY-DEBUG]   creating: id=${item.id}, type=${item.displayType}, anchorIdx=${item.anchorMessageIndex}, anchorMsgId=${anchorMsg?.id}`);
      uiInteraction.createDisplayInteraction(
        item.id,
        item.displayType,
        { afterMessageId: anchorMsg?.id },
        item.result,
      );
      created++;
    }
    console.log(`[DISPLAY-DEBUG]   result: created=${created}, skipped=${skipped}`);
  } catch (e) {
    console.error(`[DISPLAY-DEBUG] restoreDisplayInteractions error:`, e);
  }
}
// #endregion restoreDisplayInteractions

// #region useDisplayPersistence
// Persist display interactions to localStorage so they survive page
// refresh. The SDK stores results only in the in-memory
// pendingInteractions map. This hook saves when new displays appear
// and restores them when a conversation loads.
//
// Message IDs are ephemeral (regenerated each session), so we store
// the message INDEX and re-map to the current ID on restore.
export function useDisplayPersistence(
  uiInteraction: UIInteractionContextValue,
  conversationId: string | null,
  messages: { id: string }[],
) {
  // Save: write to localStorage when new display interactions appear
  const prevDisplayCountRef = useRef(0);
  const saveConvRef = useRef<string | null>(null);
  useEffect(() => {
    if (!conversationId) return;
    const allDisplays = Array.from(uiInteraction.pendingInteractions.values()).filter((i) => i.type === "display");
    console.log(`[DISPLAY-DEBUG] SAVE effect: convId=${conversationId}, saveConvRef=${saveConvRef.current}, displays=${allDisplays.length}, prevCount=${prevDisplayCountRef.current}, total=${uiInteraction.pendingInteractions.size}`);
    // When conversation changes, reset the counter and skip this run.
    // The pendingInteractions still reference the OLD conversation's data
    // (state update from clearInteractions hasn't been applied yet), so
    // saving now would write stale data under the new conversation's key.
    if (saveConvRef.current !== conversationId) {
      console.log(`[DISPLAY-DEBUG] SAVE: conv changed, skipping save`);
      prevDisplayCountRef.current = 0;
      saveConvRef.current = conversationId;
      return;
    }
    const displays = Array.from(uiInteraction.pendingInteractions.values())
      .filter((i) => i.type === "display" && i.resolved);
    if (displays.length > 0 && displays.length > prevDisplayCountRef.current) {
      const data = displays.map((d) => {
        const anchorIdx = messages.findIndex(
          (m) => m.id === d.data.afterMessageId,
        );
        return {
          id: d.id,
          displayType: d.data.displayType,
          anchorMessageIndex: anchorIdx >= 0 ? anchorIdx : undefined,
          result: d.result,
        };
      });
      try {
        console.log(`[DISPLAY-DEBUG] SAVE: writing ${data.length} displays to localStorage for convId=${conversationId}`, data.map(d => d.id));
        localStorage.setItem(
          `display:${conversationId}`,
          JSON.stringify(data),
        );
      } catch {}
    }
    prevDisplayCountRef.current = displays.length;
  }, [uiInteraction.pendingInteractions, conversationId, messages]);

  // Restore: recreate display interactions from localStorage on load.
  // No dedup guard — the restore function is idempotent (skips items
  // that already exist via getInteraction check), and we must always
  // restore after clearInteractions wipes the map on conversation switch.
  useEffect(() => {
    const mapSize = uiInteraction.pendingInteractions.size;
    const displayCount = Array.from(uiInteraction.pendingInteractions.values()).filter(i => i.type === "display").length;
    console.log(`[DISPLAY-DEBUG] RESTORE effect: convId=${conversationId}, messages.length=${messages.length}, mapSize=${mapSize}, displaysInMap=${displayCount}`);
    if (!conversationId || messages.length === 0) {
      console.log(`[DISPLAY-DEBUG] RESTORE: early return (no convId or no messages)`);
      return;
    }
    restoreDisplayInteractions(uiInteraction, conversationId, messages);
  }, [conversationId, messages.length, uiInteraction.pendingInteractions]); // eslint-disable-line react-hooks/exhaustive-deps
}
// #endregion useDisplayPersistence
