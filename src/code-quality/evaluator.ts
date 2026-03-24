// code-quality/evaluator.ts — scores a code file against 5 quality criteria (0-2 each = 0-10 total).
//
// Teaching note: This is the SAME pattern as src/autoresearch/evaluator.ts,
// but applied to CODE instead of product plans.
// The Karpathy insight generalises: any artifact you can score can be improved in a loop.
// The Epic Refinement Loop scores epics. The code quality loop scores code.
//
// Each criterion has two checks:
//   1. Rule check  — deterministic (no API call, instant, free)
//   2. LLM check   — semantic (one batched Claude call for all 5 checks)
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "The Code Quality Loop"

import { callClaudeJson } from "../shared/claude.js";
import { settings } from "../shared/config.js";
import type {
  CodeCriterionScore,
  CodeQualityResult,
  LLMCodeScoringResponse,
} from "../shared/types/index.js";

const CRITERIA = [
  "no_lint_errors",
  "no_security_issues",
  "readability",
  "test_coverage_intent",
  "epic_alignment",
] as const;

type CriterionName = (typeof CRITERIA)[number];

// ─── Rule Checks (deterministic, no API call) ─────────────────────────────────

/**
 * WHAT: Counts obvious code quality markers that suggest lint problems.
 * WHY:  Quick proxy for lint health without running a real linter.
 *       If a file is full of "any", "TODO", and "FIXME", it's not clean.
 */
function ruleNoLintErrors(code: string): [0 | 1, string] {
  const lines = code.split("\n");
  const anyCount = (code.match(/:\s*any\b/g) ?? []).length;
  const todoCount = (code.match(/TODO|FIXME/g) ?? []).length;
  if (anyCount > 3)     return [0, `Found ${anyCount} uses of 'any' type (threshold: 3).`];
  if (todoCount > 2)    return [0, `Found ${todoCount} TODO/FIXME comments (threshold: 2).`];
  if (lines.length > 300) return [0, `File is ${lines.length} lines (threshold: 300).`];
  return [1, `No obvious lint issues: ${anyCount} 'any', ${todoCount} TODO/FIXME, ${lines.length} lines.`];
}

/**
 * WHAT: Scans code for common security anti-patterns.
 * WHY:  Some security bugs are textbook patterns — eval(), innerHTML, hardcoded passwords.
 *       A simple text scan catches these without needing a real security scanner.
 *       Think of it like a metal detector: not perfect, but fast and catches the obvious stuff.
 */
function ruleNoSecurityIssues(code: string): [0 | 1, string] {
  const dangerPatterns: Array<[RegExp, string]> = [
    [/\beval\s*\(/g,              "eval() — dangerous code execution"],
    [/\.innerHTML\s*=/g,          "innerHTML assignment — XSS risk"],
    [/password\s*=\s*["']\w+["']/gi, "hardcoded password string"],
    [/secret\s*=\s*["']\w+["']/gi,   "hardcoded secret string"],
    [/api_?key\s*=\s*["']\w+["']/gi, "hardcoded API key"],
  ];
  for (const [pattern, label] of dangerPatterns) {
    if (pattern.test(code)) return [0, `Security pattern found: ${label}`];
  }
  return [1, "No obvious security anti-patterns detected."];
}

/**
 * WHAT: Checks structural readability — file length and function count.
 * WHY:  Long files and many tiny functions both hurt readability. This is a rough
 *       proxy: it won't catch everything, but extreme cases are reliably bad.
 */
function ruleReadability(code: string): [0 | 1, string] {
  const lines = code.split("\n");
  if (lines.length > 200) {
    return [0, `File is ${lines.length} lines (threshold: 200 for readability).`];
  }
  const functionCount = (code.match(/\bfunction\b|\b=>\s*\{|\basync\s+\(/g) ?? []).length;
  if (functionCount > 0) {
    const avgLines = Math.round(lines.length / functionCount);
    if (avgLines > 30) {
      return [0, `Avg ~${avgLines} lines/function (threshold: 30). Functions may be too long.`];
    }
  }
  return [1, `File length and function density look fine (${lines.length} lines, ~${functionCount} functions).`];
}

/**
 * WHAT: Checks whether the code string contains test patterns.
 * WHY:  We can't run tests here, but we can check if they exist.
 *       Untested code is a risk — this nudges the loop to generate tests.
 */
function ruleTestCoverageIntent(code: string): [0 | 1, string] {
  if (/\b(describe|it|test|expect)\s*\(/.test(code)) {
    return [1, "Code contains test patterns (describe/it/test/expect)."];
  }
  if (/\bassert\b|\.toBe\(|\.toEqual\(/.test(code)) {
    return [1, "Code contains assertions or Jest matchers."];
  }
  return [0, "No test patterns found. Consider adding tests for core logic."];
}

/**
 * WHAT: Epic alignment has no meaningful rule check — only the LLM can judge it.
 * WHY:  Whether code implements the epic's intended outcome requires understanding
 *       both the code AND the epic. That's semantic, not a pattern match.
 */
function ruleEpicAlignment(_code: string): [0 | 1, string] {
  return [0, "No rule check for epic alignment — evaluated by LLM only."];
}

// ─── LLM Scoring (one batched call for all 5 criteria) ───────────────────────

const LLM_SCORING_SYSTEM = `You are a strict code quality reviewer. Score each criterion 0 or 1.
0 = clearly fails. 1 = clearly meets. Be conservative — only give 1 if you're confident.

SCORING GUIDE:
- no_lint_errors: Clean code? No obvious TypeScript errors, unused imports, or 'any' types?
- no_security_issues: No eval(), innerHTML, or hardcoded credentials?
- readability: Clear variable names, reasonable function sizes, no deeply nested logic?
- test_coverage_intent: Does the code look testable? Are core paths covered or easily coverable?
- epic_alignment: Does this code actually implement the epic's stated outcome?`;

// Mock fixtures for --mock mode (no API key needed)
const MOCK_LLM_CODE_SCORES: LLMCodeScoringResponse[] = [
  // Iteration 0: poor code (total rule+LLM = 2/10)
  {
    no_lint_errors:       { score: 0, rationale: "mock: multiple 'any' types and TODO comments present" },
    no_security_issues:   { score: 0, rationale: "mock: uses eval() and innerHTML — dangerous patterns" },
    readability:          { score: 0, rationale: "mock: deeply nested logic, magic numbers throughout" },
    test_coverage_intent: { score: 0, rationale: "mock: no test patterns, core paths untested" },
    epic_alignment:       { score: 1, rationale: "mock: code implements the feature, just poorly" },
  },
  // Iteration 1: improved code (total = 6/10)
  {
    no_lint_errors:       { score: 1, rationale: "mock: no 'any' types, TODOs removed" },
    no_security_issues:   { score: 1, rationale: "mock: eval and innerHTML removed" },
    readability:          { score: 0, rationale: "mock: function names still unclear, some magic numbers remain" },
    test_coverage_intent: { score: 1, rationale: "mock: basic test structure added for main paths" },
    epic_alignment:       { score: 1, rationale: "mock: code implements all epic scope items" },
  },
  // Iteration 2: good code (total = 9/10)
  {
    no_lint_errors:       { score: 1, rationale: "mock: fully typed, no lint issues" },
    no_security_issues:   { score: 1, rationale: "mock: no security anti-patterns" },
    readability:          { score: 1, rationale: "mock: clear names, small functions, no magic numbers" },
    test_coverage_intent: { score: 1, rationale: "mock: tests cover happy path and main error cases" },
    epic_alignment:       { score: 1, rationale: "mock: code fully implements the epic outcome" },
  },
];

async function llmScoreCode(
  code: string,
  epicOutcome: string,
  iterationIndex: number
): Promise<LLMCodeScoringResponse> {
  if (settings.mockMode) {
    return MOCK_LLM_CODE_SCORES[Math.min(iterationIndex, MOCK_LLM_CODE_SCORES.length - 1)];
  }
  return callClaudeJson<LLMCodeScoringResponse>({
    system: LLM_SCORING_SYSTEM,
    userMessage: `EPIC OUTCOME (what this code should achieve):\n${epicOutcome}\n\nCODE TO EVALUATE:\n\`\`\`\n${code}\n\`\`\`\n\nScore each criterion and return the JSON object.`,
    maxTokens: 600,
  });
}

// ─── Improvement Hints ────────────────────────────────────────────────────────

const HINTS: Record<CriterionName, string> = {
  no_lint_errors:
    "Remove all 'any' types — add explicit TypeScript types. Resolve TODO/FIXME comments. Keep files under 300 lines; split large files into focused modules.",
  no_security_issues:
    "Remove eval() — use JSON.parse() or direct property access. Replace innerHTML with textContent or a sanitisation library. Move all secrets to environment variables.",
  readability:
    "Rename variables to be self-describing (e.g. 'userCount' not 'n'). Extract functions longer than 20 lines into smaller named helpers. Replace magic numbers with named constants.",
  test_coverage_intent:
    "Add at least one test for the main happy path and one for the main error case. Use describe/it blocks. Each test name should describe what it checks.",
  epic_alignment:
    "Re-read the epic outcome and check: does your code directly cause that outcome? If not, add the missing parts. Focus on the success metrics — they define 'done'.",
};

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * WHAT: Scores a code string against 5 quality criteria and returns a 0-10 score.
 * WHY:  This is the read-only evaluator in the code quality loop. The agent can't
 *       edit this file, so it can't cheat by lowering the bar. The rules stay fixed.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "The Code Quality Loop"
 */
export async function evaluateCode(
  code: string,
  targetFile: string,
  epicOutcome: string,
  iterationIndex: number = 0
): Promise<CodeQualityResult> {
  const ruleResults: Record<CriterionName, [0 | 1, string]> = {
    no_lint_errors:       ruleNoLintErrors(code),
    no_security_issues:   ruleNoSecurityIssues(code),
    readability:          ruleReadability(code),
    test_coverage_intent: ruleTestCoverageIntent(code),
    epic_alignment:       ruleEpicAlignment(code),
  };

  const llmResults = await llmScoreCode(code, epicOutcome, iterationIndex);

  const criteria: CodeCriterionScore[] = CRITERIA.map((name) => {
    const [ruleScore, ruleRationale] = ruleResults[name];
    const { score: llmScore, rationale: llmRationale } = llmResults[name];
    const total = (ruleScore + llmScore) as 0 | 1 | 2;
    return { name, ruleScore, llmScore, total, ruleRationale, llmRationale };
  });

  const total = criteria.reduce((sum, c) => sum + c.total, 0);
  const improvementHints = criteria
    .filter((c) => c.total < 2)
    .map((c) => HINTS[c.name as CriterionName]);

  return { criteria, total, improvementHints, targetFile };
}
