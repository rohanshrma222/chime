import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { z } from "zod";
import type { Tool } from "@chime/core";
import { resolveInside } from "./paths.ts";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".turbo", ".next"]);
const MAX_MATCHES = 100;
const MAX_FILE_BYTES = 1_000_000;

const schema = z.object({
  pattern: z.string().describe("Regular expression to search for"),
  path: z
    .string()
    .optional()
    .describe("File or directory to search, relative to the working directory (default: the working directory itself)"),
});

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        yield* walk(full);
      }
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

export const grepTool: Tool<z.infer<typeof schema>> = {
  name: "grep",
  description: "Search file contents with a regular expression. Returns matching lines as path:line: text.",
  inputSchema: schema,
  async execute({ pattern, path }, ctx) {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      throw new Error(`Invalid regular expression: ${pattern}`);
    }

    const start = resolveInside(ctx.cwd, path ?? ".");
    const files: AsyncIterable<string> | Iterable<string> = (await stat(start)).isDirectory() ? walk(start) : [start];
    const matches: string[] = [];

    for await (const file of files) {
      if ((await stat(file)).size > MAX_FILE_BYTES) {
        continue;
      }
      const text = await readFile(file, "utf8");
      if (text.includes("\0")) {
        continue;
      }
      for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (!regex.test(line)) {
          continue;
        }
        const shownPath = relative(ctx.cwd, file).replaceAll("\\", "/");
        matches.push(`${shownPath}:${index + 1}: ${line.trim().slice(0, 200)}`);
        if (matches.length >= MAX_MATCHES) {
          return `${matches.join("\n")}\n[stopped after ${MAX_MATCHES} matches]`;
        }
      }
    }

    return matches.length > 0 ? matches.join("\n") : "No matches.";
  },
};
