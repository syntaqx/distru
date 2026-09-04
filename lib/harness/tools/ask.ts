import { z } from "zod";
import { defineTool } from "../tool";

/**
 * ask_user is a first-class tool the model uses to get a structured decision
 * from the human mid-task (e.g. "Category 'Edibles' doesn't exist - create it?").
 * It shares the interrupt/resume machinery with mutation confirmations but is a
 * distinct "question" gate: the user's answer becomes the tool result.
 */
export const askUser = defineTool({
  name: "ask_user",
  description:
    "Ask the user a clarifying question and wait for their answer before " +
    "continuing. Use for genuinely ambiguous decisions (which column is the SKU, " +
    "whether to create new categories, how to handle duplicates). Prefer offering " +
    "concrete options.",
  gate: "question",
  inputSchema: z.object({
    question: z.string(),
    options: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          description: z.string().optional(),
        }),
      )
      .optional(),
    allow_free_text: z.boolean().optional(),
  }),
  buildPreview(input) {
    return {
      kind: "question",
      question: input.question,
      options: input.options ?? [],
      allowFreeText: input.allow_free_text ?? (input.options?.length ? false : true),
    };
  },
  async execute(input, _ctx, extra) {
    const answer = extra?.answer ?? "";
    return {
      ok: true,
      summary: `User answered: ${answer}`,
      data: { question: input.question, answer },
    };
  },
});
