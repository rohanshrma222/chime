import type { TaskResult } from "./run.ts";

export interface EvalReport {
  generatedAt: string;
  passed: number;
  total: number;
  results: TaskResult[];
}

export function buildReport(results: TaskResult[]): EvalReport {
  return {
    generatedAt: new Date().toISOString(),
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    results,
  };
}

export function formatHumanReadable(report: EvalReport): string {
  const lines = report.results.map((r) => {
    const status = r.pass ? "PASS" : "FAIL";
    const seconds = (r.durationMs / 1000).toFixed(1);
    return `${status}  ${r.name}  (${seconds}s)`;
  });
  lines.push("");
  lines.push(`${report.passed}/${report.total} passed`);
  return lines.join("\n");
}
