import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const fixWrongSortComparator: EvalTask = {
  name: "fix-wrong-sort-comparator",
  prompt:
    "sortAscending in src.js sorts numbers incorrectly for some inputs. Fix the bug so all tests pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `/** Returns a new array of numbers sorted in ascending numeric order. Must not mutate \`nums\`. */
function sortAscending(nums) {
  return [...nums].sort();
}
module.exports = { sortAscending };
`,
    "test.js": buildTestFile(
      'const { sortAscending } = require("./src.js");',
      `  await test("sorts small numbers", () => assert.deepEqual(sortAscending([3, 1, 2]), [1, 2, 3]));
  await test("sorts numbers where string order would differ", () =>
    assert.deepEqual(sortAscending([10, 9, 2]), [2, 9, 10]));
  await test("does not mutate the input", () => {
    const input = [3, 1, 2];
    sortAscending(input);
    assert.deepEqual(input, [3, 1, 2]);
  });`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
