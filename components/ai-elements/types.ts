import type { ToolUIPart } from "ai";

export type ToolUIState =
  | ToolUIPart["state"]
  | "approval-requested"
  | "approval-responded"
  | "output-denied";

