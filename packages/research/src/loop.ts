import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { AgentLoop, ToolRegistry } from "@chime/core";
import type { Provider } from "@chime/core";
import { grepTool, readFileTool } from "@chime/tools";
import { makeScratchpadTool, readUrlTool, webSearchTool } from "./tools.ts";

export interface ResearchResult {
  answer: string;
  scratchpadPath: string;
}

function createResearchId(): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return `${stamp}-${randomUUID().slice(0, 4)}`;
}

function buildSystemPrompt(scratchpadPath: string): string {
  return [
    "You are Chime's research assistant. You answer multi-step questions by actually researching, not guessing.",
    "Follow this process:",
    "1. Write a short plan to the scratchpad with update_scratchpad before searching anything.",
    "2. Gather information with web_search and read_url (and grep/read_file if the question is about this codebase).",
    "3. After each useful finding, append it to the scratchpad with update_scratchpad, including the source URL.",
    "4. Before finalizing, re-read your scratchpad notes and check for gaps; search again only if something the question actually asked for is missing.",
    "5. You have a limited number of tool calls. As soon as you have enough to answer what was actually asked — do not keep gathering more depth than the question requires — stop searching and give your final answer as plain text (no more tool calls), a synthesized report that cites sources by URL.",
    `Your scratchpad file is ${scratchpadPath} — always pass the full note text to update_scratchpad, it appends automatically.`,
  ].join("\n");
}

export async function runResearch(provider: Provider, question: string): Promise<ResearchResult> {
  const scratchpadPath = join(homedir(), ".chime", "research", `${createResearchId()}.md`);

  const tools = new ToolRegistry();
  for (const tool of [webSearchTool, readUrlTool, grepTool, readFileTool, makeScratchpadTool(scratchpadPath)]) {
    tools.register(tool);
  }

  const loop = new AgentLoop(provider, tools, buildSystemPrompt(scratchpadPath), {
    cwd: process.cwd(),
    maxRounds: 25,
    maxContextTokens: 100_000,
  });

  const answer = await loop.run(question);
  return { answer, scratchpadPath };
}
