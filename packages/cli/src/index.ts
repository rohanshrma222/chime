import { Command } from "commander";
import chalk from "chalk";
import { AgentLoop, ToolRegistry } from "@chime/core";
import { OpenRouterProvider } from "@chime/providers";
import { startRepl } from "./repl.ts";

try {
  process.loadEnvFile();
} catch {
  
}

const SYSTEM_PROMPT = "You are Chime, a concise and helpful coding assistant.";

new Command()
  .name("chime")
  .description("Coding agent CLI harness")
  .action(async () => {
    const agent = new AgentLoop(new OpenRouterProvider(), new ToolRegistry(), SYSTEM_PROMPT);
    await startRepl(agent);
  })
  .parseAsync()
  .catch((error) => {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });