import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * A fresh, disposable directory — not a worktree of this repo (fixture content is
 * throwaway and unrelated to chime's own history; sharing .git object storage with the
 * main repo wouldn't make sense here). `git init` just gives the agent's tools a normal
 * repo to operate in and a clean initial commit, same as any real project it might work on.
 */
export async function createSandbox(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "chime-eval-"));

  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }

  execFileSync("git", ["init", "-q"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "eval@chime.local"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "chime-eval"], { cwd: dir });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: dir });

  return dir;
}

export async function destroySandbox(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export function runScoreCommand(dir: string, command: string[]): { exitCode: number; output: string } {
  try {
    const output = execFileSync(command[0]!, command.slice(1), {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { exitCode: 0, output };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; message: string };
    return { exitCode: err.status ?? 1, output: err.stdout ?? err.message };
  }
}
