import { z } from "zod";
import type { Tool } from "@chime/core";

const MAX_RESULT_CHARS = 20_000;

function clip(text: string, max = MAX_RESULT_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[truncated: ${text.length} characters total, showing the first ${max}]`;
}

const searchSchema = z.object({
  query: z.string().describe("The search query"),
  max_results: z.number().int().min(1).max(10).optional().describe("How many results to return (default 5)"),
});

export const webSearchTool: Tool<z.infer<typeof searchSchema>> = {
  name: "web_search",
  description: "Search the web and return a list of relevant results (title, url, snippet).",
  inputSchema: searchSchema,
  async execute({ query, max_results }) {
    const key = process.env.TAVILY_API_KEY;
    if (!key) {
      return "Error: TAVILY_API_KEY is not set.";
    }

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, search_depth: "basic", max_results: max_results ?? 5 }),
    });

    if (!res.ok) {
      return `Error: search failed with status ${res.status}`;
    }

    const data = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
    const results = data.results ?? [];
    if (results.length === 0) {
      return "No results found.";
    }

    const text = results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}`).join("\n\n");
    return clip(text);
  },
};

const readUrlSchema = z.object({
  url: z.string().describe("The URL to fetch and read"),
});

function htmlToText(html: string): string {
  const withoutJunk = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const withBreaks = withoutJunk.replace(/<\/(p|div|br|li|h[1-6])>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  return stripped
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export const readUrlTool: Tool<z.infer<typeof readUrlSchema>> = {
  name: "read_url",
  description: "Fetch a URL and return its visible text content (HTML tags stripped).",
  inputSchema: readUrlSchema,
  async execute({ url }) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": "chime-research/0.0.0" } });
    } catch (error) {
      return `Error: could not fetch ${url} (${error instanceof Error ? error.message : String(error)})`;
    }
    if (!res.ok) {
      return `Error: ${url} returned status ${res.status}`;
    }
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    const text = contentType.includes("html") ? htmlToText(body) : body;
    return clip(text);
  },
};

export function makeScratchpadTool(filePath: string): Tool<{ text: string }> {
  const schema = z.object({
    text: z.string().describe("Text to append to the research scratchpad"),
  });
  return {
    name: "update_scratchpad",
    description:
      "Append a note to your running research scratchpad (your plan, findings so far, or a gap you've spotted). " +
      "Use it every time you learn something or change direction, so your reasoning stays visible.",
    inputSchema: schema,
    async execute({ text }) {
      const { appendFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, `\n${text}\n`, "utf8");
      return "Noted.";
    },
  };
}
