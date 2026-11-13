import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AgentLoop } from "@chime/core";
import type { Provider } from "@chime/core";
import { createDefaultRegistry } from "@chime/tools";
import { createSandbox, destroySandbox, runScoreCommand } from "./sandbox.ts";
import { allTasks } from "./tasks/index.ts";
import type { EvalTask } from "./types.ts";

export interface TaskResult {
  name: string;
  pass: boolean;
  durationMs: number;
  detail: string;
}

const TASK_TIMEOUT_MS = 120_000;
const MAX_ROUNDS = 10;

function buildEvalSystemPrompt(cwd: string): string {
  const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
  return [
    "You are a coding agent being evaluated on one small, self-contained task.",
    `Working directory: ${cwd}`,
    `Platform: ${process.platform}. Shell commands run through ${shell}.`,
    "Make the smallest correct change. You may run the tests to check your work, but never modify a file the task describes as a test file.",
    "Once you believe the task is complete, reply with a short confirmation and stop.",
  ].join("\n");
}

export async function runTask(provider: Provider, task: EvalTask): Promise<TaskResult> {
  const start = Date.now();
  const dir = await createSandbox(task.files);

  try {
    const protectedBefore = new Map<string, string>();
    for (const file of task.protectedFiles) {
      protectedBefore.set(file, await readFile(join(dir, file), "utf8"));
    }

    const tools = createDefaultRegistry();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);

    const loop = new AgentLoop(provider, tools, buildEvalSystemPrompt(dir), {
      cwd: dir,
      maxRounds: MAX_ROUNDS,
      confirm: async () => "approved", // no human in the loop; the sandbox is disposable
      signal: controller.signal,
    });

    try {
      await loop.run(task.prompt);
    } finally {
      clearTimeout(timeout);
    }

    for (const file of task.protectedFiles) {
      const after = await readFile(join(dir, file), "utf8");
      if (after !== protectedBefore.get(file)) {
        return { name: task.name, pass: false, durationMs: Date.now() - start, detail: `${file} was modified — invalid` };
      }
    }

    const score = runScoreCommand(dir, task.scoreCommand);
    return { name: task.name, pass: score.exitCode === 0, durationMs: Date.now() - start, detail: score.output };
  } catch (error) {
    return {
      name: task.name,
      pass: false,
      durationMs: Date.now() - start,
      detail: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    await destroySandbox(dir);
  }
}

/** Matches the error text a daily (not per-minute) OpenRouter free-model quota produces.
 * Once this hits, every remaining task would fail identically and pointlessly — the quota
 * won't recover within this run no matter how long it waits. */
function isDailyQuotaExhausted(detail: string): boolean {
  return /rate limit exceeded.*(per-day|daily)/i.test(detail);
}

/** Runs tasks sequentially, not in parallel — this project's free-tier model has tight
 * per-minute and per-day request caps, and running many tasks at once would multiply
 * concurrent requests for no benefit the eval itself needs. */
export async function runEval(provider: Provider, tasks: EvalTask[] = allTasks): Promise<TaskResult[]> {
  const results: TaskResult[] = [];
  for (const task of tasks) {
    const result = await runTask(provider, task);
    results.push(result);

    if (isDailyQuotaExhausted(result.detail)) {
      for (const remaining of tasks.slice(results.length)) {
        results.push({
          name: remaining.name,
          pass: false,
          durationMs: 0,
          detail: "Skipped: the daily free-model request quota ran out earlier in this run.",
        });
      }
      break;
    }
  }
  return results;
}
