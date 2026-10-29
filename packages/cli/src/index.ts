import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import {
  AgentLoop,
  createSessionId,
  listSessions,
  loadSession,
  saveSession,
  type Message,
} from "@chime/core";
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

const program = new Command().name("chime").description("Coding agent CLI harness");

program
  .command("sessions")
  .description("Manage saved sessions")
  .command("list")
  .description("List saved sessions, newest first")
  .action(async () => {
    const sessions = await listSessions();
    if (sessions.length === 0) {
      console.log(chalk.dim("No saved sessions."));
      return;
    }
    for (const s of sessions) {
      console.log(`${chalk.cyan(s.id)}  ${s.messageCount} msgs  ${chalk.dim(s.cwd)}  (updated ${s.updatedAt})`);
    }
  });

program
  .option("--cwd <dir>", "directory the agent works in", process.cwd())
  .option("--resume <id>", "resume a previous session by id")
  .action(async (options: { cwd: string; resume?: string }) => {
    let cwd: string;
    let initialMessages: Message[] | undefined;
    let sessionId: string;

    if (options.resume) {
      const session = await loadSession(options.resume);
      cwd = session.cwd;
      initialMessages = session.messages;
      sessionId = session.id;
      console.log(
        chalk.dim(`Resuming session ${sessionId} (${session.messages.length} messages, cwd: ${cwd})\n`),
      );
    } else {
      cwd = resolve(options.cwd);
      if (!(await stat(cwd).catch(() => null))?.isDirectory()) {
        throw new Error(`--cwd is not a directory: ${cwd}`);
      }
      sessionId = createSessionId();
      console.log(chalk.dim(`Session: ${sessionId}\n`));
    }

    const provider = new OpenRouterProvider();
    const tools = createDefaultRegistry();
    await startRepl(
      (hooks) => new AgentLoop(provider, tools, buildSystemPrompt(cwd), { cwd, initialMessages, ...hooks }),
      { onTurnEnd: (messages) => saveSession(sessionId, cwd, messages) },
    );
  });

program.parseAsync().catch((error) => {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
