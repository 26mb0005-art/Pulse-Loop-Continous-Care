import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText, type ModelMessage } from "ai";
import type { z } from "zod";

const MODEL = "openai/gpt-6-astra";
const RUN_HEADER = "X-Lovable-AIG-Run-ID";

function runIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_HEADER)) headers.set(RUN_HEADER, runId);
    const res = await fetch(input, { ...init, headers });
    runId ??= res.headers.get(RUN_HEADER)?.trim() || undefined;
    return res;
  };
}

/** Streams a structured-output Responses call and returns the parsed object (throws on failure). */
export async function aiObject<T>(schema: z.ZodType<T>, instructions: string, messages: ModelMessage[]): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI not configured");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch(),
  });
  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages,
    maxRetries: 0,
    output: Output.object({ schema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return (await result.output) as T;
}

const BANNED = /\b(dose|dosage|mg\b|stop taking|discontinue|prescrib|increase your medic|reduce your medic|cure|revers|diagnos)/i;
export function isUnsafe(...texts: (string | undefined | null)[]) {
  return texts.some((t) => t && BANNED.test(t));
}
