import type { Message, Provider, StreamEvent, ToolDefinition } from "@chime/core";

function isRateLimited(error: unknown): boolean {
  return typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 429;
}

/**
 * A 429 can mean two very different things: a per-minute burst limit (worth waiting out —
 * it resets in seconds) or a per-day quota (won't recover within any retry budget this
 * process could reasonably wait — it resets hours from now). Retrying the latter just
 * burns `retries * delayMs` doing nothing; detected via OpenRouter's own message text
 * since the response carries no structured "which kind of 429 is this" field.
 */
export function isDailyQuotaExhausted(error: unknown): boolean {
  if (!isRateLimited(error)) return false;
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? "");
  return /per-day|daily/i.test(message);
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
          if (isDailyQuotaExhausted(error) || !isRateLimited(error) || attempt >= retries) {
            throw error;
          }
          await wait(delayMs);
        }
      }
    },
  };
}
