import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { AgentLoop } from "@chime/core";
import { OpenRouterProvider } from "@chime/providers";
import { createDefaultRegistry } from "@chime/tools";
import { startRepl } from "./repl.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env file: rely on variables already set in the shell
}

function buildSystemPrompt(cwd: string): string {
  const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
  return [
    "You are Chime, a concise and helpful coding assistant working in the user's terminal.",
    `Working directory: ${cwd}`,
    `Platform: ${process.platform}. Shell commands run through ${shell}.`,
    "Look at files with your tools before changing them, make small edits, and run the project's tests to check your work.",
  ].join("\n");
}

new Command()
  .name("chime")
  .description("Coding agent CLI harness")
  .option("--cwd <dir>", "directory the agent works in", process.cwd())
  .action(async (options: { cwd: string }) => {
    const cwd = resolve(options.cwd);
    if (!(await stat(cwd).catch(() => null))?.isDirectory()) {
      throw new Error(`--cwd is not a directory: ${cwd}`);
    }

    const provider = new OpenRouterProvider();
    const tools = createDefaultRegistry();
    await startRepl((hooks) => new AgentLoop(provider, tools, buildSystemPrompt(cwd), { cwd, ...hooks }));
  })
  .parseAsync()
  .catch((error) => {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });
