import type { Message, ToolDefinition, StreamEvent } from "./types.js";

export interface Provider {
    stream(
        messages: Message[],
        tools: ToolDefinition[],
    ): AsyncIterable<StreamEvent>;
}