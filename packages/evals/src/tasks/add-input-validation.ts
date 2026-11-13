import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const addInputValidation: EvalTask = {
  name: "add-input-validation",
  prompt:
    "divide in src.js doesn't match its own docstring. Fix it so all tests pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `/** Divides a by b. Throws an Error("Cannot divide by zero") if b is 0. */
function divide(a, b) {
  return a / b;
}
module.exports = { divide };
`,
    "test.js": buildTestFile(
      'const { divide } = require("./src.js");',
      `  await test("divides normally", () => assert.equal(divide(10, 2), 5));
  await test("throws on division by zero", () => assert.throws(() => divide(1, 0), /Cannot divide by zero/));`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
