/**
 * Shared harness types: the human-in-the-loop preview shapes and the NDJSON
 * event protocol streamed from the runner to the chat UI.
 */

export type PreviewField = { label: string; value: string };

/** Rendered as an Approve / Reject card for a mutating tool. */
export type ConfirmationPreview = {
  kind: "confirmation";
  title: string;
  summary: string;
  fields: PreviewField[];
  risk?: "low" | "medium" | "high";
};

export type QuestionOption = {
  label: string;
  value: string;
  description?: string;
};

/** Rendered as a structured question card by the ask_user tool. */
export type QuestionPreview = {
  kind: "question";
  question: string;
  options: QuestionOption[];
  allowFreeText: boolean;
};

export type HarnessToolPreview = ConfirmationPreview | QuestionPreview;

/** A tool call awaiting a human decision. Terminates the streamed turn. */
export type Interrupt = {
  toolUseId: string;
  name: string;
  preview: HarnessToolPreview;
};

/** NDJSON events emitted by the runner. One JSON object per line. */
export type HarnessEvent =
  | { type: "message_start"; messageId: string }
  | { type: "thinking"; text: string }
  | { type: "token"; text: string }
  | { type: "tool_start"; toolUseId: string; name: string }
  | { type: "tool_input"; toolUseId: string; partialJson: string }
  | {
      type: "tool_result";
      toolUseId: string;
      name: string;
      ok: boolean;
      summary: string;
    }
  | { type: "interrupt"; interrupts: Interrupt[] }
  | { type: "error"; message: string }
  | { type: "done"; stopReason: string | null };

/** How a pending tool call was resolved by a human. */
export type ToolDecision =
  | { toolUseId: string; decision: "approve" }
  | { toolUseId: string; decision: "reject"; reason?: string }
  | { toolUseId: string; decision: "answer"; value: string };
