import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { AgentLoop, ToolRegistry } from "@chime/core";
import type { Provider } from "@chime/core";
import { recursiveQuery } from "@chime/rlm";
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

function buildGatherPrompt(scratchpadPath: string): string {
  return [
    "You are Chime's research assistant, in the GATHERING phase (a separate step synthesizes the final answer later — you don't write it).",
    "1. Write a short plan to the scratchpad with update_scratchpad before searching anything.",
    "2. Gather information with web_search and read_url (and grep/read_file if the question is about this codebase).",
    "3. After each useful finding, append it to the scratchpad with update_scratchpad, including the source URL.",
    "4. Before stopping, re-check for gaps and search again only if something the question asked for is missing.",
    "5. Once you've gathered enough, reply with a short plain-text acknowledgment (no more tool calls) — this ends the gathering phase. Your reply itself is discarded; only the scratchpad is used for the final answer.",
    `Your scratchpad file is ${scratchpadPath} — always pass the full note text to update_scratchpad, it appends automatically.`,
  ].join("\n");
}

export async function runResearch(provider: Provider, question: string): Promise<ResearchResult> {
  const scratchpadPath = join(homedir(), ".chime", "research", `${createResearchId()}.md`);

  const tools = new ToolRegistry();
  for (const tool of [webSearchTool, readUrlTool, grepTool, readFileTool, makeScratchpadTool(scratchpadPath)]) {
    tools.register(tool);
  }

  const loop = new AgentLoop(provider, tools, buildGatherPrompt(scratchpadPath), {
    cwd: process.cwd(),
    maxRounds: 25,
    maxContextTokens: 100_000,
  });

  await loop.run(question); // gather phase; its own text reply is discarded

  const scratchpadContent = await readFile(scratchpadPath, "utf8").catch(() => "");
  const answer = await recursiveQuery(scratchpadContent, question, provider);

  return { answer, scratchpadPath };
}
