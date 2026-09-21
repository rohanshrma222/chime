import { z } from "zod";
import type { Message, ToolCall } from "./types.ts";
import type { Provider } from "./provider.ts";
import type { ToolRegistry } from "./tools.ts";

export interface ConfirmRequest {
  toolName: string;
  summary: string;
}

export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

export interface AgentLoopOptions {
  cwd?: string;
  confirm?: ConfirmFn;
  onToolCall?: (call: ToolCall) => void;
  maxRounds?: number;
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

    try {
      if (tool.requiresConfirmation) {
        if (!this.options.confirm) {
          return `Error: "${call.name}" needs the user's confirmation, but no confirmation handler is configured.`;
        }
        const summary = tool.preview ? await tool.preview(parsed.data, ctx) : JSON.stringify(parsed.data);
        const approved = await this.options.confirm({ toolName: tool.name, summary });
        if (!approved) {
          return "The user denied this action. Do not retry it; ask the user what they want instead.";
        }
      }
      return await tool.execute(parsed.data, ctx);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}