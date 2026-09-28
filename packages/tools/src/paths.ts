import { isAbsolute, relative, resolve, sep } from "node:path";

export function resolveInside(cwd: string, inputPath: string): string {
  const absolute = resolve(cwd, inputPath);
  const rel = relative(cwd, absolute);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Path "${inputPath}" is outside the working directory (${cwd}).`);
  }
  return absolute;
}
