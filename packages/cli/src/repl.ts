import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import chalk from "chalk";
import type { AgentLoop } from "@chime/core";

export async function startRepl(agent: AgentLoop): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  let closed = false;
  rl.on("close", () => {
    closed = true;
  });

  console.log(chalk.dim('Chime — type a message. "exit" or Ctrl+C to quit.\n'));
  rl.setPrompt(chalk.cyan("you › "));
  rl.prompt();

  for await (const raw of rl) {
    const line = raw.trim();
    if (line === "exit" || line === "/exit") break;

    if (line !== "") {
      stdout.write(chalk.green("chime › "));
      try {
        await agent.run(line, (text) => stdout.write(text));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stdout.write(chalk.red(`\n[error] ${message}`));
      }
      stdout.write("\n\n");
    }

    if (closed) break;
    rl.prompt();
  }

  rl.close();
}