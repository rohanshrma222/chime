import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const fixMissingAwait: EvalTask = {
  name: "fix-missing-await",
  prompt: "Running `node test.js` fails. Fix the bug in src.js so all tests pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `async function double(n) {
  return n * 2;
}

/** Returns double(n) plus 1. */
async function doublePlusOne(n) {
  const doubled = double(n);
  return doubled + 1;
}

module.exports = { double, doublePlusOne };
`,
    "test.js": buildTestFile(
      'const { doublePlusOne } = require("./src.js");',
      `  await test("doubles and adds one", async () => assert.equal(await doublePlusOne(3), 7));
  await test("works for zero", async () => assert.equal(await doublePlusOne(0), 1));`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
