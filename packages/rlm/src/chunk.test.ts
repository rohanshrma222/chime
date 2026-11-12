import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk.ts";

describe("chunkText", () => {
  it("returns the whole text as one chunk when it fits", () => {
    expect(chunkText("hello", 100)).toEqual(["hello"]);
  });

  it("splits into multiple overlapping chunks when too long", () => {
    const text = "a".repeat(1000);
    const chunks = chunkText(text, 300, 50);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("").length).toBeGreaterThanOrEqual(text.length);
    const firstEnd = chunks[0]!.slice(-50);
    const secondStart = chunks[1]!.slice(0, 50);
    expect(firstEnd).toBe(secondStart);
  });

  it("terminates even when overlap is set larger than the chunk size", () => {
    const text = "x".repeat(500);
    const chunks = chunkText(text, 100, 10_000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThan(100);
  });
});
