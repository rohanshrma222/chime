import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const fixMutationBug: EvalTask = {
  name: "fix-mutation-bug",
  prompt:
    "removeDuplicates in src.js mutates its input array, which its docstring says it must not do. Fix the bug so all tests pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `/** Returns a new array with duplicate values removed, preserving order. Must not modify \`arr\`. */
function removeDuplicates(arr) {
  const seen = new Set();
  for (let i = arr.length - 1; i >= 0; i--) {
    if (seen.has(arr[i])) {
      arr.splice(i, 1);
    } else {
      seen.add(arr[i]);
    }
  }
  return arr;
}
module.exports = { removeDuplicates };
`,
    "test.js": buildTestFile(
      'const { removeDuplicates } = require("./src.js");',
      `  await test("removes duplicates", () => assert.deepEqual(removeDuplicates([1, 2, 2, 3, 1]), [1, 2, 3]));
  await test("does not mutate the input array", () => {
    const input = [1, 2, 2, 3];
    const inputCopy = [...input];
    removeDuplicates(input);
    assert.deepEqual(input, inputCopy);
  });`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
