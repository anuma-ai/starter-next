/**
 * Creates a streaming response that can be consumed by the chat UI.
 * This is a simplified replacement for the ai package's createUIMessageStreamResponse.
 */

type StreamEvent = {
  type: "text-start" | "text-delta" | "text-end" | "error";
  id?: string;
  delta?: string;
  errorText?: string;
};

export function createUIMessageStreamResponse({
  stream,
  status = 200,
}: {
  stream: ReadableStream<StreamEvent>;
  status?: number;
}): Response {
  const encoder = new TextEncoder();

  const transformedStream = stream.pipeThrough(
    new TransformStream<StreamEvent, Uint8Array>({
      transform(event, controller) {
        // Format as newline-delimited JSON (NDJSON)
        const json = JSON.stringify(event);
        controller.enqueue(encoder.encode(json + "\n"));
      },
    })
  );

  return new Response(transformedStream, {
    status,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
