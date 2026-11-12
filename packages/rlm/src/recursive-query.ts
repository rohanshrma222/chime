import { estimateTokens } from "@chime/core";
import type { Message, Provider } from "@chime/core";
import { chunkText } from "./chunk.ts";

const SYSTEM_PROMPT =
  "Answer the question using only the information in the provided context. " +
  "If the context doesn't contain the answer, say so plainly. Be concise.";

async function askModel(provider: Provider, userPrompt: string): Promise<string> {
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];
  let text = "";
  for await (const event of provider.stream(messages, [])) {
    if (event.type === "text") text += event.text;
  }
  return text;
}

export interface RecursiveQueryOptions {
  /** Approximate token budget per direct model call. Default 6000. */
  maxContextTokens?: number;
  /** Characters of overlap between adjacent chunks. Default 200. */
  overlapChars?: number;
}

/**
 * Answers a question against a body of context too large for one request:
 * if it fits the budget, answer directly; otherwise split it into chunks,
 * recurse on each (answering the same question against just that chunk),
 * then recurse again on the combined sub-answers — which naturally handles
 * both "reduce once" and "reduce in multiple passes" with the same code path.
 */
export async function recursiveQuery(
  context: string,
  question: string,
  provider: Provider,
  options: RecursiveQueryOptions = {},
): Promise<string> {
  const maxContextTokens = options.maxContextTokens ?? 6000;
  const prompt = `Context:\n${context}\n\nQuestion: ${question}`;

  if (estimateTokens(prompt) <= maxContextTokens) {
    return askModel(provider, prompt);
  }

  // ~4 chars/token, same approximation @chime/core's context-manager uses; reserve
  // headroom for the question and prompt scaffolding around the raw context.
  const maxChars = Math.floor(maxContextTokens * 4 * 0.7);
  const chunks = chunkText(context, maxChars, options.overlapChars ?? 200);

  if (chunks.length <= 1) {
    // Chunking couldn't shrink it further (e.g. one giant unbroken token) — send as-is
    // rather than recursing forever on an identical input.
    return askModel(provider, prompt);
  }

  const subAnswers = await Promise.all(chunks.map((chunk) => recursiveQuery(chunk, question, provider, options)));
  const combined = subAnswers.map((answer, i) => `[Part ${i + 1}]\n${answer}`).join("\n\n");

  return recursiveQuery(combined, question, provider, options);
}
