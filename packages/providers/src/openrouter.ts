import { OpenRouter } from "@openrouter/sdk";
import type { EventStream } from "@openrouter/sdk/lib/event-streams.js";
import type { ChatMessages, ChatStreamChunk } from "@openrouter/sdk/models";
import type { Message, Provider, StreamEvent, ToolDefinition } from "@chime/core";

const MODEL = "poolside/laguna-s-2.1:free";

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

function toChatMessage(message: Message): ChatMessages {
  switch (message.role) {
    case "system":
      return { role: "system", content: message.content };
    case "user":
      return { role: "user", content: message.content };
    case "assistant":
      return { role: "assistant", content: message.content };
    case "tool":
      return { role: "tool", content: message.content, toolCallId: message.toolCallId ?? "" };
  }
}

export class OpenRouterProvider implements Provider {
  private client: OpenRouter;

  constructor(apiKey = process.env.OPENROUTER_API_KEY) {
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    this.client = new OpenRouter({ apiKey });
  }

  async *stream(messages: Message[], tools: ToolDefinition[]): AsyncIterable<StreamEvent> {
    const response = await this.client.chat.send({
      chatRequest: {
        model: MODEL,
        stream: true,
        messages: messages.map(toChatMessage),
        ...(tools.length > 0
          ? {
              tools: tools.map((tool) => ({
                type: "function" as const,
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.inputSchema as Record<string, unknown>,
                },
              })),
            }
          : {}),
      },
    });

    const eventStream = response as EventStream<ChatStreamChunk>;
  
    const pending = new Map<number, PendingToolCall>();

    for await (const chunk of eventStream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        yield { type: "text", text: delta.content };
      }

      for (const call of delta?.toolCalls ?? []) {
        const existing = pending.get(call.index);
        pending.set(call.index, {
          id: call.id ?? existing?.id ?? "",
          name: call.function?.name ?? existing?.name ?? "",
          arguments: (existing?.arguments ?? "") + (call.function?.arguments ?? ""),
        });
      }
    }

    for (const call of pending.values()) {
      yield {
        type: "tool_call",
        toolCall: {
          id: call.id,
          name: call.name,
          input: call.arguments ? JSON.parse(call.arguments) : {},
        },
      };
    }
  }
}
