import type { EvalTask } from "../types.ts";
import { addInputValidation } from "./add-input-validation.ts";
import { addMissingExport } from "./add-missing-export.ts";
import { fixMissingAwait } from "./fix-missing-await.ts";
import { fixMutationBug } from "./fix-mutation-bug.ts";
import { fixOffByOne } from "./fix-off-by-one.ts";
import { fixRegexBug } from "./fix-regex-bug.ts";
import { fixSyntaxError } from "./fix-syntax-error.ts";
import { fixWrongComparison } from "./fix-wrong-comparison.ts";
import { fixWrongSortComparator } from "./fix-wrong-sort-comparator.ts";
import { implementDebounce } from "./implement-debounce.ts";
import { implementGroupBy } from "./implement-group-by.ts";
import { implementIsPalindrome } from "./implement-is-palindrome.ts";

export const allTasks: EvalTask[] = [
  fixOffByOne,
  implementIsPalindrome,
  fixWrongComparison,
  addMissingExport,
  fixMissingAwait,
  implementGroupBy,
  fixRegexBug,
  fixMutationBug,
  implementDebounce,
  fixSyntaxError,
  addInputValidation,
  fixWrongSortComparator,
];
