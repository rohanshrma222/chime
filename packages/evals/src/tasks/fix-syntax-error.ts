import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const fixSyntaxError: EvalTask = {
  name: "fix-syntax-error",
  prompt:
    "Running `node test.js` fails immediately with a syntax error, before any test even runs. Find and fix the syntax error in src.js so all tests pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `function square(n) {
  return n * n;

function cube(n) {
  return n * n * n;
}

module.exports = { square, cube };
`,
    "test.js": buildTestFile(
      'const { square, cube } = require("./src.js");',
      `  await test("square works", () => assert.equal(square(4), 16));
  await test("cube works", () => assert.equal(cube(3), 27));`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
