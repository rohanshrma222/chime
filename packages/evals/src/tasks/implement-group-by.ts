import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const implementGroupBy: EvalTask = {
  name: "implement-group-by",
  prompt: "Implement groupBy in src.js per its docstring so all tests in test.js pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `/**
 * Groups \`items\` into an object keyed by \`keyFn(item)\`. Each key maps to an array
 * of items that produced that key, in their original order.
 * Example: groupBy([1, 2, 3, 4], n => n % 2 === 0 ? "even" : "odd")
 *   => { odd: [1, 3], even: [2, 4] }
 */
function groupBy(items, keyFn) {
  throw new Error("Not implemented");
}
module.exports = { groupBy };
`,
    "test.js": buildTestFile(
      'const { groupBy } = require("./src.js");',
      `  await test("groups by parity", () =>
    assert.deepEqual(groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? "even" : "odd")), { odd: [1, 3], even: [2, 4] }));
  await test("empty array groups to empty object", () => assert.deepEqual(groupBy([], (x) => x), {}));
  await test("all items in one group", () => assert.deepEqual(groupBy([1, 2, 3], () => "all"), { all: [1, 2, 3] }));`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
