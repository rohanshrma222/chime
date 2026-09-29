import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { Tool } from "@chime/core";
import { resolveInside } from "./paths.ts";

const schema = z.object({
  path: z.string().describe("Path to the file, relative to the working directory"),
  old_string: z
    .string()
    .describe("Exact text to replace. It must match exactly once in the file. Use an empty string to create a new file."),
  new_string: z.string().describe("The text to put in its place (or the full contents of the new file)"),
});

async function computeEdit(
  file: string,
  oldString: string,
  newString: string,
): Promise<{ existed: boolean; after: string }> {
  let before: string | null = null;
  try {
    before = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  if (oldString === "") {
    if (before !== null) {
      throw new Error("The file already exists. Pass the text to replace in old_string to edit it.");
    }
    return { existed: false, after: newString };
  }
  if (before === null) {
    throw new Error("The file does not exist. Use an empty old_string to create it.");
  }

  const eol = before.includes("\r\n") ? "\r\n" : "\n";
  const match = oldString.replace(/\r?\n/g, eol);
  const replacement = newString.replace(/\r?\n/g, eol);

  const first = before.indexOf(match);
  if (first === -1) {
    throw new Error(
      "old_string was not found in the file. Read the file again and copy the text exactly, including whitespace.",
    );
  }
  if (before.indexOf(match, first + 1) !== -1) {
    throw new Error("old_string matches more than once. Include more surrounding lines so it matches exactly once.");
  }
  return { existed: true, after: before.slice(0, first) + replacement + before.slice(first + match.length) };
}

function prefixLines(prefix: string, text: string, maxLines = 40): string {
  const lines = text.split("\n");
  const shown = lines.slice(0, maxLines).map((line) => `${prefix} ${line}`);
  if (lines.length > maxLines) {
    shown.push(`${prefix} ... (${lines.length - maxLines} more lines)`);
  }
  return shown.join("\n");
}

export const editFileTool: Tool<z.infer<typeof schema>> = {
  name: "edit_file",
  description:
    "Edit a file by replacing one exact piece of text (old_string) with new text (new_string). " +
    "old_string must appear exactly once. To create a new file, pass an empty old_string and the file contents as new_string.",
  inputSchema: schema,
  requiresConfirmation: true,
  async preview({ path, old_string, new_string }, ctx) {
    const { existed } = await computeEdit(resolveInside(ctx.cwd, path), old_string, new_string);
    if (!existed) {
      return `Create ${path}\n${prefixLines("+", new_string)}`;
    }
    return `Edit ${path}\n${prefixLines("-", old_string)}\n${prefixLines("+", new_string)}`;
  },
  async execute({ path, old_string, new_string }, ctx) {
    const file = resolveInside(ctx.cwd, path);
    const { existed, after } = await computeEdit(file, old_string, new_string);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, after, "utf8");
    return existed ? `Edited ${path}` : `Created ${path}`;
  },
};
