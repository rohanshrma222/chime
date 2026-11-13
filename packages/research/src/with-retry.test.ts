import { describe, expect, it } from "vitest";
import { withRetry } from "./with-retry.ts";
import type { Provider } from "@chime/core";

function errorWithStatus(statusCode: number, message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function scriptedProvider(errors: (Error | null)[]): { provider: Provider; calls: number[] } {
  const calls: number[] = [];
  let i = 0;
  const provider: Provider = {
    async *stream() {
      calls.push(Date.now());
      const error = errors[i]!;
      i += 1;
      if (error) throw error;
      yield { type: "text", text: "ok" };
    },
  };
  return { provider, calls };
}

describe("withRetry", () => {
  it("passes through a non-429 error immediately, without retrying", async () => {
    const { provider, calls } = scriptedProvider([new Error("boom")]);
    const wrapped = withRetry(provider, { retries: 3, delayMs: 10 });

    await expect(async () => {
      for await (const _ of wrapped.stream([], [])) {
        // drain
      }
    }).rejects.toThrow("boom");
    expect(calls).toHaveLength(1);
  });

  it("retries a per-minute rate limit and succeeds once it clears", async () => {
    const { provider, calls } = scriptedProvider([errorWithStatus(429, "Rate limit exceeded: per-minute"), null]);
    const wrapped = withRetry(provider, { retries: 3, delayMs: 10 });

    const events = [];
    for await (const event of wrapped.stream([], [])) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "text", text: "ok" }]);
    expect(calls).toHaveLength(2);
  });

  it("fails fast on a daily quota error instead of burning through all retries", async () => {
    const dailyError = errorWithStatus(429, "Rate limit exceeded: free-models-per-day. Add 10 credits...");
    const { provider, calls } = scriptedProvider([dailyError, null, null, null]);
    const wrapped = withRetry(provider, { retries: 3, delayMs: 10_000 }); // a real delay — must NOT actually wait

    const start = Date.now();
    await expect(async () => {
      for await (const _ of wrapped.stream([], [])) {
        // drain
      }
    }).rejects.toThrow(/free-models-per-day/);

    expect(calls).toHaveLength(1); // never retried
    expect(Date.now() - start).toBeLessThan(1000); // never waited delayMs
  });
});
