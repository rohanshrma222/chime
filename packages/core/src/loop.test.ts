import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AgentLoop } from "./loop.ts";
import { ToolRegistry } from "./tools.ts";
import type { Provider } from "./provider.ts";
import type { StreamEvent } from "./types.ts";

function scriptedProvider(scripts: StreamEvent[][]): Provider {
  let call = 0;
  return {
    async *stream() {
      const events = scripts[call] ?? [];
      call += 1;
      for (const event of events) {
        yield event;
      }
    },
  };
}

describe("AgentLoop", () => {
  it("returns the assistant's text when there are no tool calls", async () => {
    const provider = scriptedProvider([[{ type: "text", text: "Hello!" }]]);
    const loop = new AgentLoop(provider, new ToolRegistry(), "You are a test agent.");

    const result = await loop.run("Hi");

    expect(result).toBe("Hello!");
    expect(loop.messages).toHaveLength(3); // system, user, assistant
  });

  it("executes a tool call and feeds the result back before finishing", async () => {
    const provider = scriptedProvider([
      [{ type: "tool_call", toolCall: { id: "1", name: "echo", input: { text: "hi" } } }],
      [{ type: "text", text: "Done!" }],
    ]);

    const tools = new ToolRegistry();
    tools.register({
      name: "echo",
      description: "echoes text back",
      inputSchema: z.object({ text: z.string() }),
      async execute(args) {
        return `echo: ${args.text}`;
      },
    });

    const loop = new AgentLoop(provider, tools, "You are a test agent.");
    const result = await loop.run("say hi");

    expect(result).toBe("Done!");
    expect(loop.messages.find((m) => m.role === "tool")?.content).toBe("echo: hi");
  });

  it("streams text chunks to onText as they arrive", async () => {
    const provider = scriptedProvider([
      [{ type: "text", text: "Hel" }, { type: "text", text: "lo" }],
    ]);
    const loop = new AgentLoop(provider, new ToolRegistry(), "You are a test agent.");
    const chunks: string[] = [];

    const result = await loop.run("Hi", (text) => chunks.push(text));

    expect(chunks).toEqual(["Hel", "lo"]);
    expect(result).toBe("Hello");
  });
});