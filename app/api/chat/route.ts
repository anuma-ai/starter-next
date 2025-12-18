import { postApiV1ChatCompletions } from "@reverbia/sdk";
import {
  createAssistantStream,
  createErrorStream,
} from "@reverbia/sdk/vercel";
import { createUIMessageStreamResponse } from "@/lib/stream";
import type { UIMessage, MessagePart } from "@/types/chat";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Convert our UIMessage format to the Portal API format
function mapMessagesToCompletionPayload(messages: UIMessage[]) {
  return messages
    .filter((msg) => ["user", "assistant", "system"].includes(msg.role))
    .map((msg) => {
      const textParts = msg.parts
        .filter((part): part is MessagePart & { type: "text" } => part.type === "text")
        .map((part) => part.text)
        .join("\n\n");

      return {
        role: msg.role,
        content: [{ type: "text", text: textParts }],
      };
    })
    .filter((msg) => msg.content[0].text);
}

export async function POST(req: Request) {
  const {
    messages,
    model,
    tools,
  }: {
    messages: UIMessage[];
    model: string;
    tools?: any[];
  } = await req.json();

  const completion = await postApiV1ChatCompletions({
    body: {
      model,
      messages: mapMessagesToCompletionPayload(messages),
      // @ts-expect-error - tools is not yet in the type definition
      tools,
    },
  });

  if (!completion.data) {
    const errorMessage =
      completion.error?.error ?? "API did not return a response.";

    return createUIMessageStreamResponse({
      stream: createErrorStream(errorMessage),
      status: 502,
    });
  }

  // Handle case where data might be a string (streaming response)
  if (typeof completion.data === "string") {
    return createUIMessageStreamResponse({
      stream: createAssistantStream(completion.data),
    });
  }

  const messageContent = completion.data.choices?.[0]?.message?.content as any;
  let responseText = "";

  if (typeof messageContent === "string") {
    responseText = messageContent.trim();
  } else if (Array.isArray(messageContent)) {
    responseText = messageContent
      .map((part: any) => part.text ?? "")
      .join("")
      .trim();
  }

  return createUIMessageStreamResponse({
    stream: createAssistantStream(responseText),
  });
}
