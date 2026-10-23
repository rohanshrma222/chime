import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Message } from "./types.ts";

export interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  cwd: string;
  messages: Message[];
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  cwd: string;
  messageCount: number;
}

function sessionsDir(): string {
  return join(homedir(), ".chime", "sessions");
}

function sessionPath(id: string): string {
  return join(sessionsDir(), `${id}.json`);
}

export function createSessionId(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  return `${stamp}-${randomUUID().slice(0, 4)}`;
}

export async function saveSession(id: string, cwd: string, messages: Message[]): Promise<void> {
  await mkdir(sessionsDir(), { recursive: true });

  let createdAt = new Date().toISOString();
  try {
    const existing = JSON.parse(await readFile(sessionPath(id), "utf8")) as SessionData;
    createdAt = existing.createdAt;
  } catch {
    // no existing file (new session) or it's unreadable — treat as new
  }

  const data: SessionData = { id, createdAt, updatedAt: new Date().toISOString(), cwd, messages };
  await writeFile(sessionPath(id), JSON.stringify(data, null, 2), "utf8");
}

export async function loadSession(id: string): Promise<SessionData> {
  let text: string;
  try {
    text = await readFile(sessionPath(id), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`No session found with id "${id}".`);
    }
    throw error;
  }
  return JSON.parse(text) as SessionData;
}

export async function listSessions(): Promise<SessionSummary[]> {
  let files: string[];
  try {
    files = await readdir(sessionsDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const summaries: SessionSummary[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }
    try {
      const data = JSON.parse(await readFile(join(sessionsDir(), file), "utf8")) as SessionData;
      summaries.push({
        id: data.id,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        cwd: data.cwd,
        messageCount: data.messages.length,
      });
    } catch {
      continue; // skip a corrupt/unreadable session file instead of failing the whole list
    }
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
