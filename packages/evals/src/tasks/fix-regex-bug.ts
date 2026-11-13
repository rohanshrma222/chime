import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const fixRegexBug: EvalTask = {
  name: "fix-regex-bug",
  prompt: "isValidEmail in src.js accepts some invalid emails. Fix the bug so all tests pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `/** Returns true if \`str\` looks like a valid email address (something@something.something). */
function isValidEmail(str) {
  return /^[^\\s@]+@[^\\s@]+$/.test(str);
}
module.exports = { isValidEmail };
`,
    "test.js": buildTestFile(
      'const { isValidEmail } = require("./src.js");',
      `  await test("valid email passes", () => assert.equal(isValidEmail("a@b.com"), true));
  await test("missing dot in domain fails", () => assert.equal(isValidEmail("a@b"), false));
  await test("missing @ fails", () => assert.equal(isValidEmail("ab.com"), false));
  await test("spaces fail", () => assert.equal(isValidEmail("a @b.com"), false));`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
