import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { postApiV1ChatCompletions } from "@reverbia/sdk";
import {
  mapMessagesToCompletionPayload,
  createAssistantStream,
  createErrorStream,
} from "@reverbia/sdk/vercel";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

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

  const responseText =
    completion.data.choices?.[0]?.message?.content?.trim() ?? "";

  return createUIMessageStreamResponse({
    stream: createAssistantStream(responseText),
  });
}
