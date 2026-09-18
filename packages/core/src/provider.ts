import type { Message, ToolDefinition, StreamEvent } from "./types.ts";

export interface Provider {
    stream(
        messages: Message[],
        tools: ToolDefinition[],
    ): AsyncIterable<StreamEvent>;
}