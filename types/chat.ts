/**
 * Custom chat types that replace the ai package types.
 * These are simplified versions of UIMessage, ChatStatus, and FileUIPart
 * from the ai package.
 */

export type ChatStatus = "streaming" | "submitted" | "error" | undefined;

export type FileUIPart = {
  type: "file";
  url: string;
  mediaType?: string;
  filename?: string;
};

export type TextPart = {
  type: "text";
  text: string;
};

export type ImageUrlPart = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

export type ImagePart = {
  type: "image";
  url: string;
  text?: string;
};

export type ReasoningPart = {
  type: "reasoning";
  text: string;
};

export type MessagePart =
  | TextPart
  | FileUIPart
  | ImageUrlPart
  | ImagePart
  | ReasoningPart;

export type MessageRole = "user" | "assistant" | "system";

export type UIMessage = {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
};
