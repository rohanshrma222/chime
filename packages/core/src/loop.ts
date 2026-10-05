import { z } from "zod";
import type { Message, ToolCall } from "./types.ts";
import type { Provider } from "./provider.ts";
import type { ToolRegistry } from "./tools.ts";

export interface ConfirmRequest {
  toolName: string;
  summary: string;
}

/** "aborted" means the session ended (e.g. Ctrl+C) — distinct from an explicit "no", which just denies this one action. */
export type ConfirmOutcome = "approved" | "denied" | "aborted";

export type ConfirmFn = (request: ConfirmRequest) => Promise<ConfirmOutcome>;

export interface AgentLoopOptions {
  cwd?: string;
  confirm?: ConfirmFn;
  onToolCall?: (call: ToolCall) => void;
  maxRounds?: number;
  signal?: AbortSignal;
}

export class AgentLoop {
  messages: Message[] = [];

  constructor(
    private provider: Provider,
    private tools: ToolRegistry,
    systemPrompt: string,
    private options: AgentLoopOptions = {},
  ) {
    this.messages.push({ role: "system", content: systemPrompt });
  }

  async run(userInput: string, onText?: (text: string) => void): Promise<string> {
    this.messages.push({ role: "user", content: userInput });

    const maxRounds = this.options.maxRounds ?? 20;

    for (let round = 0; round < maxRounds; round++) {
      if (this.options.signal?.aborted) {
        throw new Error("Aborted.");
      }

      const toolDefs = this.tools.list().map((tool) => {
        const { $schema: _ignored, ...schema } = z.toJSONSchema(tool.inputSchema);
        return { name: tool.name, description: tool.description, inputSchema: schema };
      });

      let text = "";
      const toolCalls: ToolCall[] = [];

      for await (const event of this.provider.stream(this.messages, toolDefs)) {
        if (event.type === "text") {
          text += event.text;
          onText?.(event.text);
        } else if (event.type === "tool_call") {
          toolCalls.push(event.toolCall);
        }
      }

      this.messages.push({
        role: "assistant",
        content: text,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      });

      if (toolCalls.length === 0) {
        return text;
      }

      for (const call of toolCalls) {
        const output = await this.executeTool(call);
        this.messages.push({ role: "tool", content: output, toolCallId: call.id });
      }
    }

    throw new Error(`Stopped after ${maxRounds} rounds of tool calls without a final answer.`);
  }

  private async executeTool(call: ToolCall): Promise<string> {
    this.options.onToolCall?.(call);

    if (call.parseError) {
      return `Error: could not parse the arguments for "${call.name}" (${call.parseError}). Re-issue the call with valid JSON arguments.`;
    }

    const tool = this.tools.get(call.name);
    if (!tool) {
      return `Error: unknown tool "${call.name}"`;
    }

    const parsed = tool.inputSchema.safeParse(call.input);
    if (!parsed.success) {
      return `Error: invalid arguments for "${call.name}":\n${z.prettifyError(parsed.error)}`;
    }

    const ctx = { cwd: this.options.cwd ?? process.cwd() };

    if (tool.requiresConfirmation) {
      if (!this.options.confirm) {
        return `Error: "${call.name}" needs the user's confirmation, but no confirmation handler is configured.`;
      }

      let summary: string;
      try {
        summary = tool.preview ? await tool.preview(parsed.data, ctx) : JSON.stringify(parsed.data);
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }

      // Deliberately outside the try/catch below: "aborted" must propagate out of
      // run() and stop the whole turn, not be swallowed into a tool-result string
      // the way a denial or a tool execution error is.
      const outcome = await this.options.confirm({ toolName: tool.name, summary });
      if (outcome === "aborted") {
        throw new Error("Aborted.");
      }
      if (outcome === "denied") {
        return "The user denied this action. Do not retry it; ask the user what they want instead.";
      }
    }

    try {
      return await tool.execute(parsed.data, ctx);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}