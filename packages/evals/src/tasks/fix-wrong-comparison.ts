import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const fixWrongComparison: EvalTask = {
  name: "fix-wrong-comparison",
  prompt: "isAdult in src.js doesn't match its own docstring. Fix the bug so all tests pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `/** Returns true if \`age\` is old enough to be considered an adult (18 or older). */
function isAdult(age) {
  return age > 18;
}
module.exports = { isAdult };
`,
    "test.js": buildTestFile(
      'const { isAdult } = require("./src.js");',
      `  await test("17 is not an adult", () => assert.equal(isAdult(17), false));
  await test("18 is an adult", () => assert.equal(isAdult(18), true));
  await test("30 is an adult", () => assert.equal(isAdult(30), true));`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
