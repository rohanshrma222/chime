/** Every sandbox gets this, so Node treats .js files as CommonJS regardless of what
 * ancestor directory (e.g. this monorepo's own ESM root) it happens to be created under. */
export const SANDBOX_PACKAGE_JSON = JSON.stringify({ name: "eval-sandbox", private: true, type: "commonjs" }, null, 2);

/** Builds a standalone test.js: no dependencies, plain node:assert, PASS/FAIL per case,
 * exit code 0 only if every case passed. `requireLine` pulls in src.js; `testCalls` is the
 * body of test(...) calls run inside an async IIFE (so async functions under test work too). */
export function buildTestFile(requireLine: string, testCalls: string): string {
  return `const assert = require("node:assert/strict");
${requireLine}

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(\`PASS: \${name}\`);
  } catch (e) {
    failures++;
    console.log(\`FAIL: \${name}: \${e.message}\`);
  }
}

(async () => {
${testCalls}
  process.exit(failures === 0 ? 0 : 1);
})();
`;
}
