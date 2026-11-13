import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runScoreCommand } from "../sandbox.ts";
import { allTasks } from "./index.ts";

/** The correct fix for each task's src.js — used only here, to prove each test.js
 * actually fails on the broken starting code and passes on the real fix, with zero
 * model calls. This is NOT shipped as part of the task data the agent is scored against. */
const fixedSrc: Record<string, string> = {
  "fix-off-by-one": `function sum(nums) {
  let total = 0;
  for (let i = 0; i < nums.length; i++) {
    total += nums[i];
  }
  return total;
}
module.exports = { sum };
`,
  "implement-is-palindrome": `function isPalindrome(str) {
  const lower = str.toLowerCase();
  return lower === lower.split("").reverse().join("");
}
module.exports = { isPalindrome };
`,
  "fix-wrong-comparison": `function isAdult(age) {
  return age >= 18;
}
module.exports = { isAdult };
`,
  "add-missing-export": `function add(a, b) {
  return a + b;
}
function multiply(a, b) {
  return a * b;
}
module.exports = { add, multiply };
`,
  "fix-missing-await": `async function double(n) {
  return n * 2;
}
async function doublePlusOne(n) {
  const doubled = await double(n);
  return doubled + 1;
}
module.exports = { double, doublePlusOne };
`,
  "implement-group-by": `function groupBy(items, keyFn) {
  const result = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}
module.exports = { groupBy };
`,
  "fix-regex-bug": `function isValidEmail(str) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(str);
}
module.exports = { isValidEmail };
`,
  "fix-mutation-bug": `function removeDuplicates(arr) {
  const seen = new Set();
  const result = [];
  for (const item of arr) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}
module.exports = { removeDuplicates };
`,
  "implement-debounce": `function debounce(fn, delayMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}
module.exports = { debounce };
`,
  "fix-syntax-error": `function square(n) {
  return n * n;
}
function cube(n) {
  return n * n * n;
}
module.exports = { square, cube };
`,
  "add-input-validation": `function divide(a, b) {
  if (b === 0) throw new Error("Cannot divide by zero");
  return a / b;
}
module.exports = { divide };
`,
  "fix-wrong-sort-comparator": `function sortAscending(nums) {
  return [...nums].sort((a, b) => a - b);
}
module.exports = { sortAscending };
`,
};

async function writeFiles(dir: string, files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await writeFile(join(dir, path), content, "utf8");
  }
}

describe("task fixtures", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    while (dirs.length > 0) {
      await rm(dirs.pop()!, { recursive: true, force: true });
    }
  });

  for (const task of allTasks) {
    it(`${task.name}: fails on the broken starting code and passes on the real fix`, async () => {
      const fixed = fixedSrc[task.name];
      expect(fixed, `no fixed reference for ${task.name}`).toBeDefined();

      const dir = await mkdtemp(join(tmpdir(), "chime-eval-fixture-"));
      dirs.push(dir);
      await writeFiles(dir, task.files);

      const broken = runScoreCommand(dir, task.scoreCommand);
      expect(broken.exitCode, `expected the unfixed ${task.name} to fail:\n${broken.output}`).not.toBe(0);
      // fix-syntax-error crashes at require() time, before any test case runs — nothing
      // reaches stdout. Every other task's broken version fails inside a test case instead,
      // which does print a "FAIL:" line.
      if (task.name !== "fix-syntax-error") {
        expect(broken.output).toContain("FAIL:");
      }

      await writeFile(join(dir, "src.js"), fixed!, "utf8");
      const fixedResult = runScoreCommand(dir, task.scoreCommand);
      expect(fixedResult.exitCode, `expected the fixed ${task.name} to pass:\n${fixedResult.output}`).toBe(0);
      expect(fixedResult.output).not.toContain("FAIL:");
    });
  }

  it("has a unique name per task", () => {
    const names = allTasks.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
