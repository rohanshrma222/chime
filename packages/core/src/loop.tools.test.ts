import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AgentLoop } from "./loop.ts";
import { ToolRegistry } from "./tools.ts";
import type { Tool } from "./tools.ts";
import type { Provider } from "./provider.ts";
import type { StreamEvent, ToolCall, ToolDefinition } from "./types.ts";

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

function toolCall(name: string, input: Record<string, unknown>, extra: Partial<ToolCall> = {}): StreamEvent {
  return { type: "tool_call", toolCall: { id: "call-1", name, input, ...extra } };
}

function echoTool(overrides: Partial<Tool> = {}): { tool: Tool; executed: string[] } {
  const executed: string[] = [];
  const tool: Tool = {
    name: "echo",
    description: "echoes text back",
    inputSchema: z.object({ text: z.string() }),
    async execute(args) {
      executed.push(args.text);
      return `echo: ${args.text}`;
    },
    ...overrides,
  };
  return { tool, executed };
}

function toolMessage(loop: AgentLoop): string | undefined {
  return loop.messages.find((m) => m.role === "tool")?.content;
}

describe("AgentLoop tool handling", () => {
  it("records the assistant's tool calls in the history", async () => {
    const provider = scriptedProvider([
      [toolCall("echo", { text: "hi" })],
      [{ type: "text", text: "Done!" }],
    ]);
    const { tool } = echoTool();
    const registry = new ToolRegistry();
    registry.register(tool);

    const loop = new AgentLoop(provider, registry, "sys");
    await loop.run("go");

    const withCalls = loop.messages.find((m) => m.role === "assistant" && m.toolCalls);
    expect(withCalls?.toolCalls).toEqual([{ id: "call-1", name: "echo", input: { text: "hi" } }]);
    const roles = loop.messages.map((m) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "tool", "assistant"]);
  });

  it("sends each tool's schema to the provider as plain JSON Schema", async () => {
    let seen: ToolDefinition[] = [];
    const provider: Provider = {
      async *stream(_messages, tools) {
        seen = tools;
        yield { type: "text", text: "ok" };
      },
    };
    const registry = new ToolRegistry();
    registry.register(echoTool().tool);

    await new AgentLoop(provider, registry, "sys").run("go");

    expect(seen).toHaveLength(1);
    expect(seen[0]?.inputSchema).toMatchObject({
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    });
    expect(seen[0]?.inputSchema).not.toHaveProperty("$schema");
  });

  it("returns a validation error to the model instead of running the tool", async () => {
    const provider = scriptedProvider([
      [toolCall("echo", { text: 5 })],
      [{ type: "text", text: "Sorry" }],
    ]);
    const { tool, executed } = echoTool();
    const registry = new ToolRegistry();
    registry.register(tool);

    const loop = new AgentLoop(provider, registry, "sys");
    await loop.run("go");

    expect(executed).toEqual([]);
    expect(toolMessage(loop)).toContain('invalid arguments for "echo"');
  });

  it("reports unparseable tool arguments without running the tool", async () => {
    const provider = scriptedProvider([
      [toolCall("echo", {}, { parseError: "Unexpected end of JSON input" })],
      [{ type: "text", text: "Sorry" }],
    ]);
    const { tool, executed } = echoTool();
    const registry = new ToolRegistry();
    registry.register(tool);

    const loop = new AgentLoop(provider, registry, "sys");
    await loop.run("go");

    expect(executed).toEqual([]);
    expect(toolMessage(loop)).toContain("could not parse");
  });

  it("turns a throwing tool into an error result and keeps going", async () => {
    const provider = scriptedProvider([
      [toolCall("echo", { text: "x" })],
      [{ type: "text", text: "Handled" }],
    ]);
    const { tool } = echoTool({
      async execute() {
        throw new Error("disk on fire");
      },
    });
    const registry = new ToolRegistry();
    registry.register(tool);

    const loop = new AgentLoop(provider, registry, "sys");
    const result = await loop.run("go");

    expect(result).toBe("Handled");
    expect(toolMessage(loop)).toBe("Error: disk on fire");
  });

  it("only runs a confirmation-gated tool when the user approves", async () => {
    const script = () => scriptedProvider([[toolCall("echo", { text: "x" })], [{ type: "text", text: "end" }]]);

    const denied = echoTool({ requiresConfirmation: true, preview: (args) => `say ${args.text}` });
    const deniedRegistry = new ToolRegistry();
    deniedRegistry.register(denied.tool);
    const requests: string[] = [];
    const deniedLoop = new AgentLoop(script(), deniedRegistry, "sys", {
      confirm: async (request) => {
        requests.push(`${request.toolName}: ${request.summary}`);
        return false;
      },
    });
    await deniedLoop.run("go");
    expect(requests).toEqual(["echo: say x"]);
    expect(denied.executed).toEqual([]);
    expect(toolMessage(deniedLoop)).toContain("denied");

    const approved = echoTool({ requiresConfirmation: true });
    const approvedRegistry = new ToolRegistry();
    approvedRegistry.register(approved.tool);
    await new AgentLoop(script(), approvedRegistry, "sys", { confirm: async () => true }).run("go");
    expect(approved.executed).toEqual(["x"]);
  });

  it("refuses a confirmation-gated tool when no confirm handler is configured", async () => {
    const provider = scriptedProvider([[toolCall("echo", { text: "x" })], [{ type: "text", text: "end" }]]);
    const { tool, executed } = echoTool({ requiresConfirmation: true });
    const registry = new ToolRegistry();
    registry.register(tool);

    const loop = new AgentLoop(provider, registry, "sys");
    await loop.run("go");

    expect(executed).toEqual([]);
    expect(toolMessage(loop)).toContain("no confirmation handler");
  });

  it("stops after maxRounds instead of looping forever", async () => {
    const provider: Provider = {
      async *stream() {
        yield toolCall("echo", { text: "again" });
      },
    };
    const registry = new ToolRegistry();
    registry.register(echoTool().tool);

    const loop = new AgentLoop(provider, registry, "sys", { maxRounds: 3 });
    await expect(loop.run("go")).rejects.toThrow(/3 rounds/);
  });
});
