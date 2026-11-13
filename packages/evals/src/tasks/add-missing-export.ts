import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const addMissingExport: EvalTask = {
  name: "add-missing-export",
  prompt:
    "Running `node test.js` fails with \"multiply is not a function\". Fix src.js so all tests pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `function add(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}

module.exports = { add };
`,
    "test.js": buildTestFile(
      'const { add, multiply } = require("./src.js");',
      `  await test("add works", () => assert.equal(add(2, 3), 5));
  await test("multiply works", () => assert.equal(multiply(2, 3), 6));`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
