import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const fixOffByOne: EvalTask = {
  name: "fix-off-by-one",
  prompt:
    "Running `node test.js` fails. Fix the bug in src.js so all tests pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `function sum(nums) {
  let total = 0;
  for (let i = 0; i <= nums.length; i++) {
    total += nums[i];
  }
  return total;
}
module.exports = { sum };
`,
    "test.js": buildTestFile(
      'const { sum } = require("./src.js");',
      `  await test("sums an empty array to 0", () => assert.equal(sum([]), 0));
  await test("sums a few numbers", () => assert.equal(sum([1, 2, 3]), 6));
  await test("sums negative numbers", () => assert.equal(sum([-1, -2, 3]), 0));`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
