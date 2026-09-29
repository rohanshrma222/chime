import { spawn } from "node:child_process";
import { z } from "zod";
import type { Tool } from "@chime/core";

const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_CAPTURE_CHARS = 1_000_000;
const MAX_RETURN_CHARS = 20_000;

const schema = z.object({
  command: z.string().describe("The shell command to run, in the working directory"),
  timeout_seconds: z
    .number()
    .int()
    .positive()
    .max(300)
    .optional()
    .describe(`Kill the command after this many seconds (default ${DEFAULT_TIMEOUT_SECONDS})`),
});

function clip(output: string): string {
  if (output.length <= MAX_RETURN_CHARS) {
    return output;
  }
  const half = MAX_RETURN_CHARS / 2;
  const omitted = output.length - MAX_RETURN_CHARS;
  return `${output.slice(0, half)}\n[... ${omitted} characters omitted ...]\n${output.slice(-half)}`;
}

function killTree(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    process.kill(pid);
  }
}

export const runShellTool: Tool<z.infer<typeof schema>> = {
  name: "run_shell",
  description:
    "Run a shell command in the working directory and return its exit code and combined output. " +
    "Use it to run tests, builds, or other commands.",
  inputSchema: schema,
  requiresConfirmation: true,
  preview: ({ command }) => `Run: ${command}`,
  execute({ command, timeout_seconds }, ctx) {
    const timeoutSeconds = timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS;

    return new Promise((resolve) => {
      const { OPENROUTER_API_KEY: _secret, ...env } = process.env;
      const child = spawn(command, { cwd: ctx.cwd, env, shell: true, stdio: ["ignore", "pipe", "pipe"] });

      let output = "";
      let timedOut = false;
      const collect = (chunk: Buffer) => {
        if (output.length < MAX_CAPTURE_CHARS) {
          output += chunk.toString();
        }
      };
      child.stdout.on("data", collect);
      child.stderr.on("data", collect);

      const timer = setTimeout(() => {
        timedOut = true;
        killTree(child.pid);
      }, timeoutSeconds * 1000);

      child.on("error", (error) => {
        clearTimeout(timer);
        resolve(`Error: ${error.message}`);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        const status = timedOut ? `Timed out and was killed after ${timeoutSeconds}s` : `Exit code ${code}`;
        resolve(`${status}\n${clip(output)}`);
      });
    });
  },
};
