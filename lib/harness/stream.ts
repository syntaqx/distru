import type { HarnessEvent } from "./types";

/**
 * Wrap an agent run in an NDJSON streaming Response. Each harness event is
 * written as one JSON line, which the chat client reads incrementally.
 */
export function ndjsonStream(
  run: (emit: (event: HarnessEvent) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: HarnessEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await run(emit);
      } catch (err) {
        emit({
          type: "error",
          message: err instanceof Error ? err.message : "Unexpected error.",
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
