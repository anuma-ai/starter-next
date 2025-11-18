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
  }: {
    messages: UIMessage[];
    model: string;
  } = await req.json();

  const completion = await postApiV1ChatCompletions({
    body: {
      model,
      messages: mapMessagesToCompletionPayload(messages),
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

  const responseText =
    completion.data.choices?.[0]?.message?.content?.trim() ?? "";

  return createUIMessageStreamResponse({
    stream: createAssistantStream(responseText),
  });
}
