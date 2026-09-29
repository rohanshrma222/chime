import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Tool } from "@chime/core";
import { resolveInside } from "./paths.ts";

const MAX_CHARS = 50_000;

const schema = z.object({
  path: z.string().describe("Path to the file, relative to the working directory"),
});

export const readFileTool: Tool<z.infer<typeof schema>> = {
  name: "read_file",
  description: "Read a text file and return its contents.",
  inputSchema: schema,
  async execute({ path }, ctx) {
    const text = await readFile(resolveInside(ctx.cwd, path), "utf8");
    if (text === "") {
      return "(empty file)";
    }
    if (text.length > MAX_CHARS) {
      return `${text.slice(0, MAX_CHARS)}\n[truncated: the file has ${text.length} characters, showing the first ${MAX_CHARS}]`;
    }
    return text;
  },
};
