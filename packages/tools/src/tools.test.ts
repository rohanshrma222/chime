import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultRegistry } from "./index.ts";
import { editFileTool } from "./edit-file.ts";
import { grepTool } from "./grep.ts";
import { listDirTool } from "./list-dir.ts";
import { resolveInside } from "./paths.ts";
import { readFileTool } from "./read-file.ts";
import { runShellTool } from "./run-shell.ts";

let dir: string;
const ctx = () => ({ cwd: dir });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "chime-tools-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("resolveInside", () => {
  it("allows paths inside the working directory and rejects escapes", () => {
    expect(resolveInside(dir, "a/b.txt")).toBe(join(dir, "a", "b.txt"));
    expect(resolveInside(dir, "..hidden/file")).toBe(join(dir, "..hidden", "file"));
    expect(() => resolveInside(dir, "../outside.txt")).toThrow(/outside the working directory/);
    expect(() => resolveInside(dir, join(dir, "..", "x"))).toThrow(/outside the working directory/);
  });
});

describe("read_file", () => {
  it("returns file contents, a marker for empty files, and rejects escapes", async () => {
    await writeFile(join(dir, "a.txt"), "hello\nworld", "utf8");
    await writeFile(join(dir, "empty.txt"), "", "utf8");

    expect(await readFileTool.execute({ path: "a.txt" }, ctx())).toBe("hello\nworld");
    expect(await readFileTool.execute({ path: "empty.txt" }, ctx())).toBe("(empty file)");
    await expect(readFileTool.execute({ path: "missing.txt" }, ctx())).rejects.toThrow(/ENOENT/);
    await expect(readFileTool.execute({ path: "../secret.txt" }, ctx())).rejects.toThrow(/outside/);
  });

  it("truncates very large files", async () => {
    await writeFile(join(dir, "big.txt"), "x".repeat(60_000), "utf8");
    const result = await readFileTool.execute({ path: "big.txt" }, ctx());
    expect(result).toContain("[truncated: the file has 60000 characters");
    expect(result.length).toBeLessThan(51_000);
  });
});

describe("list_dir", () => {
  it("lists entries sorted, marking folders with a slash", async () => {
    await mkdir(join(dir, "src"));
    await writeFile(join(dir, "b.txt"), "", "utf8");
    await writeFile(join(dir, "a.txt"), "", "utf8");

    expect(await listDirTool.execute({}, ctx())).toBe("a.txt\nb.txt\nsrc/");
    expect(await listDirTool.execute({ path: "src" }, ctx())).toBe("(empty directory)");
  });
});

describe("grep", () => {
  it("finds matches recursively, skips node_modules, and reports no matches", async () => {
    await mkdir(join(dir, "src"));
    await mkdir(join(dir, "node_modules"));
    await writeFile(join(dir, "src", "a.ts"), "const a = 1;\nTODO: fix\n", "utf8");
    await writeFile(join(dir, "node_modules", "dep.js"), "TODO: ignored\n", "utf8");

    expect(await grepTool.execute({ pattern: "TODO" }, ctx())).toBe("src/a.ts:2: TODO: fix");
    expect(await grepTool.execute({ pattern: "nothing-here" }, ctx())).toBe("No matches.");
    expect(await grepTool.execute({ pattern: "const", path: "src/a.ts" }, ctx())).toBe("src/a.ts:1: const a = 1;");
    await expect(grepTool.execute({ pattern: "(" }, ctx())).rejects.toThrow(/Invalid regular expression/);
  });
});

describe("edit_file", () => {
  it("replaces text that appears exactly once", async () => {
    await writeFile(join(dir, "f.txt"), "one\ntwo\nthree\n", "utf8");
    const result = await editFileTool.execute({ path: "f.txt", old_string: "two", new_string: "2" }, ctx());
    expect(result).toBe("Edited f.txt");
    expect(await readFile(join(dir, "f.txt"), "utf8")).toBe("one\n2\nthree\n");
  });

  it("does not treat $ patterns in the replacement specially", async () => {
    await writeFile(join(dir, "f.txt"), "price: X\n", "utf8");
    await editFileTool.execute({ path: "f.txt", old_string: "X", new_string: "$& and $1" }, ctx());
    expect(await readFile(join(dir, "f.txt"), "utf8")).toBe("price: $& and $1\n");
  });

  it("errors when old_string is missing or ambiguous, and leaves the file alone", async () => {
    await writeFile(join(dir, "f.txt"), "aa\naa\n", "utf8");
    await expect(
      editFileTool.execute({ path: "f.txt", old_string: "zz", new_string: "y" }, ctx()),
    ).rejects.toThrow(/not found/);
    await expect(
      editFileTool.execute({ path: "f.txt", old_string: "aa", new_string: "y" }, ctx()),
    ).rejects.toThrow(/more than once/);
    expect(await readFile(join(dir, "f.txt"), "utf8")).toBe("aa\naa\n");
  });

  it("creates a new file (and folders) when old_string is empty, but not over an existing one", async () => {
    const result = await editFileTool.execute(
      { path: "new/dir/x.txt", old_string: "", new_string: "hi" },
      ctx(),
    );
    expect(result).toBe("Created new/dir/x.txt");
    expect(await readFile(join(dir, "new", "dir", "x.txt"), "utf8")).toBe("hi");
    await expect(
      editFileTool.execute({ path: "new/dir/x.txt", old_string: "", new_string: "again" }, ctx()),
    ).rejects.toThrow(/already exists/);
  });

  it("matches multi-line text in files that use Windows line endings", async () => {
    await writeFile(join(dir, "crlf.txt"), "a\r\nb\r\nc\r\n", "utf8");
    await editFileTool.execute({ path: "crlf.txt", old_string: "a\nb", new_string: "A\nB" }, ctx());
    expect(await readFile(join(dir, "crlf.txt"), "utf8")).toBe("A\r\nB\r\nc\r\n");
  });

  it("previews the change and validates it before anything is written", async () => {
    await writeFile(join(dir, "f.txt"), "one\ntwo\n", "utf8");
    const preview = await editFileTool.preview!({ path: "f.txt", old_string: "two", new_string: "2" }, ctx());
    expect(preview).toBe("Edit f.txt\n- two\n+ 2");
    await expect(
      editFileTool.preview!({ path: "f.txt", old_string: "nope", new_string: "x" }, ctx()),
    ).rejects.toThrow(/not found/);
    expect(await readFile(join(dir, "f.txt"), "utf8")).toBe("one\ntwo\n");
  });
});

describe("run_shell", () => {
  it("returns the exit code and output", async () => {
    const ok = await runShellTool.execute({ command: 'node -e "console.log(\'hi\')"' }, ctx());
    expect(ok).toMatch(/^Exit code 0\nhi/);

    const failed = await runShellTool.execute({ command: 'node -e "process.exit(3)"' }, ctx());
    expect(failed).toMatch(/^Exit code 3/);
  });

  it("runs in the working directory", async () => {
    await writeFile(join(dir, "marker.txt"), "x", "utf8");
    const result = await runShellTool.execute({ command: 'node -e "console.log(require(\'fs\').existsSync(\'marker.txt\'))"' }, ctx());
    expect(result).toContain("true");
  });

  it("does not pass the API key to the commands it runs", async () => {
    process.env.OPENROUTER_API_KEY = "secret-value";
    try {
      const result = await runShellTool.execute(
        { command: "node -e \"console.log(process.env.OPENROUTER_API_KEY ?? 'unset')\"" },
        ctx(),
      );
      expect(result).toContain("unset");
      expect(result).not.toContain("secret-value");
    } finally {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it("kills a command that runs too long", async () => {
    const started = Date.now();
    const result = await runShellTool.execute(
      { command: 'node -e "setTimeout(() => {}, 60000)"', timeout_seconds: 1 },
      ctx(),
    );
    expect(result).toMatch(/^Timed out and was killed after 1s/);
    expect(Date.now() - started).toBeLessThan(10_000);
  });
});

describe("createDefaultRegistry", () => {
  it("registers all five tools", () => {
    expect(
      createDefaultRegistry()
        .list()
        .map((tool) => tool.name)
        .sort(),
    ).toEqual(["edit_file", "grep", "list_dir", "read_file", "run_shell"]);
  });
});
