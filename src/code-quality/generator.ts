// code-quality/generator.ts — generates improved versions of a code file.
//
// Teaching note: This is the "single modifiable file" pattern from the Karpathy article,
// applied to code. The generator reads the current code, reads the improvement hints
// from the last evaluation, and asks Claude to produce a better version.
//
// The key constraints:
//   1. Only ONE file is modified per iteration (the target code file).
//   2. The file is written to disk after generation so it's inspectable.
//   3. If candidatePath is provided, the code is also written there so git can track it.
//
// LEARN MORE: docs/HOW_IT_WORKS.md → "The Code Quality Loop"

import * as fs from "fs";
import { callClaudeJson } from "../shared/claude.js";
import { settings } from "../shared/config.js";

// ─── Mock Fixtures ────────────────────────────────────────────────────────────
// Three progressively better code strings used in --mock mode.
// They simulate: bad code → improved code → good code.
// This lets students run the full loop without an API key.

const MOCK_CODE_FIXTURES = [
  // Iteration 0: poor quality code
  `// TODO: fix this later
function processUserData(data: any) {
  var x = eval(data.formula);
  document.getElementById('result').innerHTML = x;
  if (data) {
    if (data.users) {
      if (data.users.length > 0) {
        for (var i = 0; i < data.users.length; i++) {
          console.log(data.users[i]);
        }
      }
    }
  }
  return x;
}`,

  // Iteration 1: better — security fixed, still has readability issues
  `// Processes user data and displays the result
function processUserData(data: UserData): number {
  const result = calculateResult(data.formula);
  const resultEl = document.getElementById('result');
  if (resultEl) {
    resultEl.textContent = String(result); // textContent is safe (no XSS)
  }
  logUsers(data.users);
  return result;
}

function calculateResult(formula: string): number {
  // TODO: implement formula parser
  return parseFloat(formula) || 0;
}

function logUsers(users: User[]): void {
  users.forEach(u => console.log(u));
}`,

  // Iteration 2: good quality code with tests
  `// processUserData — processes user data and updates the UI.
// Implements the onboarding analytics feature from the epic.

interface UserData {
  formula: string;
  users: User[];
}

interface User {
  id: string;
  name: string;
}

/**
 * WHAT: Processes user data and safely updates the DOM result display.
 * WHY:  Uses textContent (not innerHTML) to prevent XSS.
 *       Uses a safe parser instead of eval().
 */
export function processUserData(data: UserData): number {
  const result = parseFormula(data.formula);
  updateResultDisplay(result);
  logUsers(data.users);
  return result;
}

function parseFormula(formula: string): number {
  const parsed = parseFloat(formula);
  if (isNaN(parsed)) throw new Error(\`Invalid formula: \${formula}\`);
  return parsed;
}

function updateResultDisplay(value: number): void {
  const el = document.getElementById('result');
  if (!el) return;
  el.textContent = value.toFixed(2); // safe — no HTML parsing
}

function logUsers(users: User[]): void {
  users.forEach((user) => console.log(\`User: \${user.id} - \${user.name}\`));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('processUserData', () => {
  it('returns the parsed numeric result', () => {
    const result = processUserData({ formula: '42', users: [] });
    expect(result).toBe(42);
  });

  it('throws for invalid formula', () => {
    expect(() => parseFormula('not-a-number')).toThrow('Invalid formula');
  });
});`,
];

// ─── Main Generate Function ───────────────────────────────────────────────────

const IMPROVE_SYSTEM = `You are a senior software engineer doing a code review and improvement pass.
You will receive:
1. The epic outcome — what this code is supposed to accomplish
2. The current code
3. A list of improvement hints from the quality evaluator

Your job: rewrite the code to address ALL of the hints.
Rules:
- Keep the same language (TypeScript/JavaScript)
- Keep the same overall structure and purpose
- Fix every issue in the hints
- Add tests if test_coverage_intent is in the hints
- Return ONLY the improved code — no explanations, no markdown fences`;

/**
 * WHAT: Generates an improved version of the given code string.
 * WHY:  This is the "generate" step of the code quality loop.
 *       It takes the current code and the evaluator's hints, and asks Claude
 *       to produce a better version. Like a code reviewer who also writes the fix.
 * LEARN MORE: docs/HOW_IT_WORKS.md → "The Code Quality Loop"
 */
export async function improveCode(
  currentCode: string,
  epicOutcome: string,
  hints: string[] | null,
  iterationIndex: number = 0,
  candidatePath?: string
): Promise<string> {
  let improvedCode: string;

  if (settings.mockMode) {
    // In mock mode, return the next fixture in the progression (bad → better → good)
    improvedCode = MOCK_CODE_FIXTURES[Math.min(iterationIndex, MOCK_CODE_FIXTURES.length - 1)];
  } else {
    const hintsText = hints && hints.length > 0
      ? `\n\nIMPROVEMENT HINTS FROM EVALUATOR:\n${hints.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
      : "\n\nNo specific hints — make general improvements.";

    const response = await callClaudeJson<{ code: string }>({
      system: IMPROVE_SYSTEM,
      userMessage: `EPIC OUTCOME:\n${epicOutcome}\n\nCURRENT CODE:\n\`\`\`\n${currentCode}\n\`\`\`${hintsText}\n\nReturn JSON: { "code": "<improved code here>" }`,
      maxTokens: 2000,
    });
    improvedCode = response.code;
  }

  // Write to candidatePath if provided — this is the "single modifiable file" pattern.
  // Writing to disk makes the current state inspectable and git-trackable.
  if (candidatePath) {
    fs.writeFileSync(candidatePath, improvedCode, "utf-8");
  }

  return improvedCode;
}
