import type { Message } from "./types.ts";

// Rough, provider-agnostic approximation (~4 characters per token for English
// text). Good enough to decide "are we anywhere near the limit", not meant to
// match any specific tokenizer exactly.
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function messageTokens(message: Message): number {
  let total = estimateTokens(message.content);
  for (const call of message.toolCalls ?? []) {
    total += estimateTokens(call.name) + estimateTokens(JSON.stringify(call.input));
  }
  return total;
}

/**
 * Keep the conversation under a token budget by dropping the oldest complete
 * turns (a turn = one user message plus everything the assistant/tools did
 * in response, up to the next user message). The system message and the
 * most recent turn are never dropped, even if the most recent turn alone
 * exceeds the budget — there's nothing safe to remove from it.
 */
export function trimToBudget(messages: Message[], maxTokens: number): Message[] {
  if (messages.length === 0) {
    return messages;
  }

  const [system, ...rest] = messages as [Message, ...Message[]];
  const turns: Message[][] = [];
  for (const message of rest) {
    if (message.role === "user" || turns.length === 0) {
      turns.push([message]);
    } else {
      turns[turns.length - 1]!.push(message);
    }
  }

  const turnTokens = turns.map((turn) => turn.reduce((sum, m) => sum + messageTokens(m), 0));
  let total = messageTokens(system) + turnTokens.reduce((a, b) => a + b, 0);

  let start = 0;
  while (start < turns.length - 1 && total > maxTokens) {
    total -= turnTokens[start]!;
    start += 1;
  }

  return [system, ...turns.slice(start).flat()];
}
