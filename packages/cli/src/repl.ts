import { createInterface, type Interface } from "node:readline";
import { stdin, stdout } from "node:process";
import chalk from "chalk";
import type { AgentLoop, ConfirmFn, ToolCall } from "@chime/core";

export interface ReplHooks {
  confirm: ConfirmFn;
  onToolCall: (call: ToolCall) => void;
  signal: AbortSignal;
}

function ask(rl: Interface, prompt: string, isClosed: () => boolean): Promise<string | null> {
  if (isClosed()) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const onClose = () => resolve(null);
    rl.once("close", onClose);
    rl.question(prompt, (answer) => {
      rl.off("close", onClose);
      resolve(answer);
    });
  });
}

function shorten(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export async function startRepl(createAgent: (hooks: ReplHooks) => AgentLoop): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  const controller = new AbortController();

  let closed = false;
  rl.on("close", () => {
    closed = true;
    controller.abort();
  });

  const agent = createAgent({
    confirm: async ({ toolName, summary }) => {
      stdout.write(`\n${chalk.yellow(`[${toolName}] wants to:`)}\n${summary}\n`);
      const answer = await ask(rl, chalk.yellow("Allow? [y/N] "), () => closed);
      return answer !== null && ["y", "yes"].includes(answer.trim().toLowerCase());
    },
    onToolCall: (call) => {
      stdout.write(chalk.dim(`\n↳ ${call.name} ${shorten(JSON.stringify(call.input))}\n`));
    },
    signal: controller.signal,
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
