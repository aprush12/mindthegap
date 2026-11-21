import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const DEFAULT_MODEL = "claude-fable-5-2";

export interface LlmRequest<T> {
  /** Identical across every call in a parse so the cached prefix (system + document) is shared. */
  system: string;
  /** The packet PDF as base64 with no newlines. Omit for text-only calls (the headline digest). */
  pdfBase64?: string;
  /** Task-specific instruction, placed after the cached prefix. */
  instruction: string;
  schema: z.ZodType<T>;
  label: string;
  maxTokens?: number;
}

/** The only surface the pipeline uses; tests inject a fake. */
export interface Llm {
  parse<T>(req: LlmRequest<T>): Promise<T>;
}

export const stripNewlines = (b64: string) => b64.replace(/[\r\n]/g, "");

export function createLlm(opts: { apiKey?: string; model?: string; client?: Anthropic } = {}): Llm {
  const client = opts.client ?? new Anthropic({ apiKey: opts.apiKey ?? process.env.ANTHROPIC_API_KEY });
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  return {
    async parse<T>(req: LlmRequest<T>): Promise<T> {
      // `thinking` is omitted entirely on purpose (Fable 5.2 rejects explicit disabled/budget configs); no prefill, no forced tool_choice.
      // The beta parse surface accepts `betas` + `fallbacks` (verified against SDK 1.12 types).
      const msg = await client.beta.messages.parse({
        model,
        max_tokens: req.maxTokens ?? 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: req.system,
        messages: [
          {
            role: "user",
            content: [
              ...(req.pdfBase64
                ? [{ type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: stripNewlines(req.pdfBase64) }, cache_control: { type: "ephemeral" as const } }]
                : []),
              { type: "text", text: req.instruction },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(req.schema) },
      });
      if (msg.stop_reason === "refusal") throw new Error(`Model refused the "${req.label}" call (stop_reason=refusal)`);
      if (msg.stop_reason === "max_tokens") throw new Error(`"${req.label}" call hit max_tokens before finishing the structured output`);
      if (msg.parsed_output == null) throw new Error(`"${req.label}" call returned no parseable structured output`);
      return msg.parsed_output as T;
    },
  };
}
