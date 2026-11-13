export interface EvalTask {
  name: string;
  /** The instruction given to the agent, with no mention of the underlying bug category. */
  prompt: string;
  /** Files written into the sandbox before the agent runs. Path (relative to the sandbox root) -> content. */
  files: Record<string, string>;
  /** Files that must be byte-identical after the agent runs, or the task fails regardless of the score command's exit code. */
  protectedFiles: string[];
  /** argv run inside the sandbox after the agent finishes. Exit code 0 = pass. */
  scoreCommand: string[];
}
