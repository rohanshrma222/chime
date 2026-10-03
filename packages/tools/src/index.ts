import { ToolRegistry } from "@chime/core";
import { editFileTool } from "./edit-file.ts";
import { grepTool } from "./grep.ts";
import { listDirTool } from "./list-dir.ts";
import { readFileTool } from "./read-file.ts";
import { runShellTool } from "./run-shell.ts";

export { editFileTool, grepTool, listDirTool, readFileTool, runShellTool };

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of [readFileTool, listDirTool, grepTool, editFileTool, runShellTool]) {
    registry.register(tool);
  }
  return registry;
}
