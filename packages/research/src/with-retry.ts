import type { Message, Provider, StreamEvent, ToolDefinition } from "@chime/core";

function isRateLimited(error: unknown): boolean {
  return typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 429;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a Provider so a 429 (rate limit) pauses and retries instead of failing the whole run.
 * A multi-round research loop makes far more requests per minute than a normal chat turn,
 * so this matters here in a way it didn't for the plain REPL.
 */
export function withRetry(provider: Provider, { retries = 3, delayMs = 20_000 } = {}): Provider {
  return {
    async *stream(messages: Message[], tools: ToolDefinition[]): AsyncIterable<StreamEvent> {
      for (let attempt = 0; ; attempt++) {
        try {
          yield* provider.stream(messages, tools);
          return;
        } catch (error) {
          if (!isRateLimited(error) || attempt >= retries) {
            throw error;
          }
          await wait(delayMs);
        }
      }
    },
  };
}
