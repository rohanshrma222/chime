 import type { ZodSchema } from "zod";

export interface ToolContext {
    cwd: string;
}

export interface Tool<TArgs = any> {
    name: string;
    description: string;
    inputSchema: ZodSchema<TArgs>;
    requiresConfirmation?: boolean;
    preview?(args: TArgs, ctx: ToolContext): string | Promise<string>;
    execute(args: TArgs, ctx: ToolContext): Promise<string>;
}

export class ToolRegistry {
    private tools = new Map<string, Tool>();

    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    list(): Tool[]{
        return [...this.tools.values()];
    }
}