import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeScratchpadTool, readUrlTool, webSearchTool } from "./tools.ts";

describe("webSearchTool", () => {
  it("fails clearly when TAVILY_API_KEY is not set", async () => {
    const original = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
    try {
      const result = await webSearchTool.execute({ query: "anything" }, { cwd: "." });
      expect(result).toContain("TAVILY_API_KEY is not set");
    } finally {
      if (original) process.env.TAVILY_API_KEY = original;
    }
  });
});

describe("readUrlTool", () => {
  it("reports a fetch failure without throwing", async () => {
    const result = await readUrlTool.execute({ url: "http://localhost:1/does-not-exist" }, { cwd: "." });
    expect(result).toContain("Error");
  });
});

describe("update_scratchpad", () => {
  const path = join(tmpdir(), "chime-research-test-scratchpad.md");

  afterEach(async () => rm(path, { force: true }));

  it("appends notes across multiple calls instead of overwriting", async () => {
    const tool = makeScratchpadTool(path);
    await tool.execute({ text: "first note" }, { cwd: "." });
    await tool.execute({ text: "second note" }, { cwd: "." });

    const content = await readFile(path, "utf8");
    expect(content).toContain("first note");
    expect(content).toContain("second note");
    expect(content.indexOf("first note")).toBeLessThan(content.indexOf("second note"));
  });
});
