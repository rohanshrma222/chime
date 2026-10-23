import { readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSessionId, listSessions, loadSession, saveSession } from "./session.ts";
import type { Message } from "./types.ts";

function sessionFile(id: string): string {
  return join(homedir(), ".chime", "sessions", `${id}.json`);
}

const createdIds: string[] = [];

afterEach(async () => {
  while (createdIds.length > 0) {
    const id = createdIds.pop()!;
    await rm(sessionFile(id), { force: true });
  }
});

function track(id: string): string {
  createdIds.push(id);
  return id;
}

describe("createSessionId", () => {
  it("produces unique, filesystem-safe ids", () => {
    const a = createSessionId();
    const b = createSessionId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-zA-Z-]+$/);
  });
});

describe("save/loadSession", () => {
  it("round-trips messages and cwd", async () => {
    const id = track(createSessionId());
    const messages: Message[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ];

    await saveSession(id, "D:\\scratch", messages);
    const loaded = await loadSession(id);

    expect(loaded.id).toBe(id);
    expect(loaded.cwd).toBe("D:\\scratch");
    expect(loaded.messages).toEqual(messages);
  });

  it("keeps the original createdAt across multiple saves", async () => {
    const id = track(createSessionId());
    await saveSession(id, "cwd", [{ role: "system", content: "sys" }]);
    const first = await loadSession(id);

    await new Promise((resolve) => setTimeout(resolve, 10));
    await saveSession(id, "cwd", [{ role: "system", content: "sys" }, { role: "user", content: "more" }]);
    const second = await loadSession(id);

    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).not.toBe(first.updatedAt);
    expect(second.messages).toHaveLength(2);
  });

  it("throws a clear error for a missing session id", async () => {
    await expect(loadSession("does-not-exist-" + Date.now())).rejects.toThrow(/No session found/);
  });

  it("writes pretty-printed JSON a human could read", async () => {
    const id = track(createSessionId());
    await saveSession(id, "cwd", [{ role: "system", content: "sys" }]);
    const raw = await readFile(sessionFile(id), "utf8");
    expect(raw).toContain("\n");
    expect(raw).toContain('"messages"');
  });
});

describe("listSessions", () => {
  it("includes saved sessions, sorted newest-updated first", async () => {
    const older = track(createSessionId());
    await saveSession(older, "cwd", [{ role: "system", content: "sys" }]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const newer = track(createSessionId());
    await saveSession(newer, "cwd", [{ role: "system", content: "sys" }, { role: "user", content: "hi" }]);

    const all = await listSessions();
    const ids = all.map((s) => s.id);
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));

    const newerSummary = all.find((s) => s.id === newer);
    expect(newerSummary?.messageCount).toBe(2);
  });
});
