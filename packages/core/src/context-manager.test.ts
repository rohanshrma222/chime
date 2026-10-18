import { describe, expect, it } from "vitest";
import { estimateTokens, trimToBudget } from "./context-manager.ts";
import type { Message } from "./types.ts";

describe("estimateTokens", () => {
  it("is roughly proportional to length", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("abcde")).toBe(2); // rounds up
  });
});

function user(content: string): Message {
  return { role: "user", content };
}
function assistant(content: string): Message {
  return { role: "assistant", content };
}
function toolResult(content: string): Message {
  return { role: "tool", content, toolCallId: "x" };
}

describe("trimToBudget", () => {
  it("returns everything when under budget", () => {
    const messages = [{ role: "system", content: "sys" } as Message, user("hi"), assistant("hello")];
    expect(trimToBudget(messages, 1000)).toEqual(messages);
  });

  it("drops the oldest complete turns first, always keeping the system message", () => {
    const messages: Message[] = [
      { role: "system", content: "sys" },
      user("turn1 question " + "x".repeat(100)),
      assistant("turn1 answer " + "x".repeat(100)),
      user("turn2 question " + "x".repeat(100)),
      assistant("turn2 answer " + "x".repeat(100)),
      user("turn3 question " + "x".repeat(100)),
      assistant("turn3 answer " + "x".repeat(100)),
    ];

    const trimmed = trimToBudget(messages, 60); // small enough to force dropping

    expect(trimmed[0]).toEqual(messages[0]); // system always first
    expect(trimmed.some((m) => m.content.includes("turn1"))).toBe(false);
    expect(trimmed.some((m) => m.content.includes("turn3"))).toBe(true); // most recent kept
  });

  it("never drops the single most recent turn, even if it alone exceeds budget", () => {
    const messages: Message[] = [
      { role: "system", content: "sys" },
      user("x".repeat(10_000)),
    ];
    const trimmed = trimToBudget(messages, 10);
    expect(trimmed).toEqual(messages);
  });

  it("keeps a tool-call/tool-result pair together instead of splitting a turn", () => {
    const messages: Message[] = [
      { role: "system", content: "sys" },
      user("turn1 " + "x".repeat(200)),
      { role: "assistant", content: "", toolCalls: [{ id: "1", name: "echo", input: { text: "hi" } }] },
      toolResult("echo: hi " + "x".repeat(200)),
      assistant("turn1 done"),
      user("turn2"),
      assistant("turn2 done"),
    ];

    const trimmed = trimToBudget(messages, 30);

    // either the whole turn1 (3 messages) is present or none of it is — never a partial tool pair
    const hasToolCall = trimmed.some((m) => m.toolCalls?.length);
    const hasToolResult = trimmed.some((m) => m.role === "tool");
    expect(hasToolCall).toBe(hasToolResult);
  });
});
