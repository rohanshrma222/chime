import type { EvalTask } from "../types.ts";
import { SANDBOX_PACKAGE_JSON, buildTestFile } from "./shared.ts";

export const implementIsPalindrome: EvalTask = {
  name: "implement-is-palindrome",
  prompt: "Implement isPalindrome in src.js per its docstring so all tests in test.js pass. Do not modify test.js.",
  files: {
    "package.json": SANDBOX_PACKAGE_JSON,
    "src.js": `/**
 * Returns true if \`str\` is a palindrome (reads the same forwards and backwards),
 * ignoring case. Non-alphanumeric characters count (no stripping of spaces/punctuation).
 */
function isPalindrome(str) {
  throw new Error("Not implemented");
}
module.exports = { isPalindrome };
`,
    "test.js": buildTestFile(
      'const { isPalindrome } = require("./src.js");',
      `  await test("empty string is a palindrome", () => assert.equal(isPalindrome(""), true));
  await test("single character is a palindrome", () => assert.equal(isPalindrome("a"), true));
  await test("simple palindrome", () => assert.equal(isPalindrome("racecar"), true));
  await test("case-insensitive palindrome", () => assert.equal(isPalindrome("RaceCar"), true));
  await test("non-palindrome", () => assert.equal(isPalindrome("hello"), false));`,
    ),
  },
  protectedFiles: ["test.js"],
  scoreCommand: ["node", "test.js"],
};
