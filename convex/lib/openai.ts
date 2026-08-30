import OpenAI from "openai";

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI intelligence layer.
// Deterministic work stays in code; the LLM handles classification, clustering,
// assessment, planning and writing. All structured calls use JSON schema mode.
// ─────────────────────────────────────────────────────────────────────────────

export const MODEL_FAST = "gpt-4o-mini";
export const MODEL_MAIN = "gpt-4.1";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in Convex env");
  if (!client) client = new OpenAI({ apiKey, maxRetries: 2, timeout: 60_000 });
  return client;
}

type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

/**
 * Call an OpenAI chat completion with a strict JSON schema and return the
 * parsed object. Retries once on malformed output.
 */
export async function chatJSON<T>(opts: {
  model?: string;
  system: string;
  user: string;
  schema: JsonSchema;
  maxTokens?: number;
}): Promise<T> {
  const model = opts.model ?? MODEL_FAST;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await openai().chat.completions.create({
      model,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: attempt === 0 ? 0.2 : 0,
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schema.name, schema: opts.schema.schema, strict: true },
      },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    });
    const text = res.choices[0]?.message?.content;
    if (!text) continue;
    try {
      return JSON.parse(text) as T;
    } catch {
      // retry with temperature 0
    }
  }
  throw new Error(`OpenAI JSON call failed for schema ${opts.schema.name}`);
}

/** Plain text completion (reports, chat replies). */
export async function chatText(opts: {
  model?: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await openai().chat.completions.create({
    model: opts.model ?? MODEL_MAIN,
    max_tokens: opts.maxTokens ?? 1500,
    temperature: 0.3,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty completion");
  return text.trim();
}
