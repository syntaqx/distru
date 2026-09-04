import type { HarnessEvent } from "@/lib/harness/types";

/** Read an NDJSON stream response, invoking onEvent for each parsed line. */
export async function readNdjson(
  res: Response,
  onEvent: (event: HarnessEvent) => void,
) {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as HarnessEvent);
        } catch {
          /* ignore partial/garbage line */
        }
      }
    }
  }
  const tail = buf.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail) as HarnessEvent);
    } catch {
      /* ignore */
    }
  }
}
