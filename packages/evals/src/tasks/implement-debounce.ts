import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const implementDebounce: EvalTask = {
  name: "implement-debounce",
  prompt: "Implement debounce in src.js per its docstring so all tests in test.js pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `/**
 * Returns a debounced version of \`fn\`: calling the returned function repeatedly only
 * invokes \`fn\` once, \`delayMs\` after the last call, with the arguments from that last call.
 */
function debounce(fn, delayMs) {
  throw new Error("Not implemented");
}
module.exports = { debounce };
`,
    "test.js": buildTestFile(
      'const { debounce } = require("./src.js");',
      `  await test("only calls fn once after rapid calls", async () => {
    let calls = 0;
    const debounced = debounce(() => {
      calls++;
    }, 50);
    debounced();
    debounced();
    debounced();
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(calls, 1);
  });
  await test("passes the latest call's arguments through", async () => {
    let lastArg = null;
    const debounced = debounce((x) => {
      lastArg = x;
    }, 30);
    debounced(1);
    debounced(2);
    debounced(3);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(lastArg, 3);
  });`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
