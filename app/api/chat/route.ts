import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { postApiV1ChatCompletions } from "@reverbia/sdk";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    model,
    webSearch,
  }: {
    messages: UIMessage[];
    model: string;
    webSearch: boolean;
  } = await req.json();

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://ai-portal-dev.zetachain.com";

  const authorizationToken =
    process.env.REVERBIA_API_KEY ??
    process.env.REVERBIA_PORTAL_API_KEY ??
    process.env.REVERBIA_TOKEN;

  const headers =
    authorizationToken != null && authorizationToken.length > 0
      ? {
          Authorization: authorizationToken.startsWith("Bearer ")
            ? authorizationToken
            : `Bearer ${authorizationToken}`,
        }
      : undefined;

  const systemPrompt =
    "You are a helpful assistant that can answer questions and help with tasks";

  const requestMessages = [
    { role: "system", content: systemPrompt },
    ...mapMessagesToCompletionPayload(messages),
  ];

  const completion = await postApiV1ChatCompletions({
    baseUrl,
    headers,
    body: {
      model: webSearch ? "perplexity/sonar" : model,
      stream: false,
      messages: requestMessages,
    },
  });

  if (!completion.data) {
    const errorMessage =
      completion.error?.error ?? "The Reverbia API did not return a response.";

    return createUIMessageStreamResponse({
      stream: createErrorStream(errorMessage),
      status: 502,
    });
  }

  const responseText =
    completion.data.choices?.[0]?.message?.content?.trim() ?? "";

  return createUIMessageStreamResponse({
    stream: createAssistantStream(responseText),
  });
}

function mapMessagesToCompletionPayload(messages: UIMessage[]) {
  return messages
    .map((message) => {
      if (
        message.role !== "user" &&
        message.role !== "assistant" &&
        message.role !== "system"
      ) {
        return null;
      }

      const textParts = message.parts
        .map((part) => (part.type === "text" ? part.text : undefined))
        .filter((part): part is string => Boolean(part && part.trim()));

      const content = textParts.join("\n\n").trim();

      if (content.length === 0) {
        return null;
      }

      return {
        role: message.role,
        content,
      };
    })
    .filter(
      (
        message
      ): message is {
        role: "user" | "assistant" | "system";
        content: string;
      } => message !== null
    );
}

function createAssistantStream(text: string) {
  const messageId = crypto.randomUUID();

  return new ReadableStream({
    start(controller) {
      controller.enqueue({
        type: "text-start",
        id: messageId,
      } as const);

      if (text.length > 0) {
        controller.enqueue({
          type: "text-delta",
          id: messageId,
          delta: text,
        } as const);
      }

      controller.enqueue({
        type: "text-end",
        id: messageId,
      } as const);

      controller.close();
    },
  });
}

function createErrorStream(errorText: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({
        type: "error",
        errorText,
      } as const);
      controller.close();
    },
  });
}
