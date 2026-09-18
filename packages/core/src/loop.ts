import type { Message, StreamEvent } from "./types.ts";
import type { Provider } from "./provider.ts";
import type { ToolRegistry } from "./tools.ts";

export class AgentLoop {
  messages: Message[] = [];

  constructor(
    private provider: Provider,
    private tools: ToolRegistry,
    systemPrompt: string,
  ) {
    this.messages.push({ role: "system", content: systemPrompt });
  }

  async run(userInput: string): Promise<string> {
    this.messages.push({ role: "user", content: userInput });

    let finalText = "";

    while (true) {
      const toolDefs = this.tools.list().map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      let text = "";
      const toolCalls: StreamEvent["type"] extends never ? never : Array<Extract<StreamEvent, { type: "tool_call" }>["toolCall"]> = [];

      for await (const event of this.provider.stream(this.messages, toolDefs)) {
        if (event.type === "text") {
          text += event.text;
        } else if (event.type === "tool_call") {
          toolCalls.push(event.toolCall);
        }
      }

      this.messages.push({ role: "assistant", content: text });
      finalText = text;

      if (toolCalls.length === 0) {
        break;
      }

      for (const call of toolCalls) {
        const tool = this.tools.get(call.name);
        const output = tool
          ? await tool.execute(call.input, { cwd: process.cwd() })
          : `Error: unknown tool "${call.name}"`;

        this.messages.push({
          role: "tool",
          content: output,
          toolCallId: call.id,
        });
      }
    }

    return finalText;
  }
}