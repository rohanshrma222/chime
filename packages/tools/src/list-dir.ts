import { readdir } from "node:fs/promises";
import { z } from "zod";
import type { Tool } from "@chime/core";
import { resolveInside } from "./paths.ts";

const MAX_ENTRIES = 500;

const schema = z.object({
  path: z
    .string()
    .optional()
    .describe("Directory to list, relative to the working directory (default: the working directory itself)"),
});

export const listDirTool: Tool<z.infer<typeof schema>> = {
  name: "list_dir",
  description: "List the files and folders in a directory. Folders end with a slash.",
  inputSchema: schema,
  async execute({ path }, ctx) {
    const entries = await readdir(resolveInside(ctx.cwd, path ?? "."), { withFileTypes: true });
    if (entries.length === 0) {
      return "(empty directory)";
    }
    const names = entries
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort((a, b) => a.localeCompare(b));
    const shown = names.slice(0, MAX_ENTRIES).join("\n");
    return names.length > MAX_ENTRIES ? `${shown}\n[showing ${MAX_ENTRIES} of ${names.length} entries]` : shown;
  },
};
