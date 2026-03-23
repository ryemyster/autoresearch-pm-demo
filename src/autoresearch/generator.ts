// Generator: takes an Epic (seed from MCP layer) and improves it.
//
// Teaching note: Unlike a typical generator that starts from a text prompt,
// this one seeds from the structured Epic that define_epic already produced.
// That means iteration 0 starts with a well-formed Epic rather than noise —
// the MCP discovery layer's work is already encoded in the seed.
//
// The feedback[] parameter threads improvement hints from the evaluator forward.
// In mock mode, returns deterministic fixtures so the loop can be demoed offline.

import { callClaudeJson } from "../shared/claude.js";
import { parseEpic } from "./epicSchema.js";
import { settings } from "../shared/config.js";
import type { Epic } from "../shared/types/index.js";

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert product manager refining a structured Epic Definition.

An epic must have:
- OUTCOME: A single sentence naming a specific user segment and a measurable change. Bad: "improve performance". Good: "Reduce checkout abandonment for mobile users aged 18-35 from 62% to below 40%".
- SCOPE.IN: 3-5 concrete deliverables included in this epic.
- SCOPE.OUT: 2-4 explicit non-features — things deliberately excluded. Scope creep starts with a missing out list.
- SUCCESS_METRICS: 2-4 metrics. Each must have a specific numeric target (not "improve" or "fast") and name the tool or method used to measure it.
- DEPENDENCIES: Named blockers only — team names, service names, or specific decisions. Not vague phrases.
- RISKS: Concrete failure modes. Not generic risks like "technical complexity".

OUTPUT FORMAT: A valid JSON object only. No markdown. No explanation outside the JSON.`;

// ─── User Prompt Builder ──────────────────────────────────────────────────────
function buildUserPrompt(seed: Epic, feedback: string[] | null): string {
  const feedbackBlock =
    feedback && feedback.length > 0
      ? `\nIMPROVEMENT HINTS FROM PREVIOUS ITERATION:\n${feedback.map((h) => `- ${h}`).join("\n")}\n\nApply these hints to produce a better version of the epic.\n`
      : "";

  return `CURRENT EPIC:
${JSON.stringify(seed, null, 2)}
${feedbackBlock}
Return an improved version of this epic as a JSON object matching the same shape.`;
}

// ─── Live Generator ───────────────────────────────────────────────────────────
export async function generate(seed: Epic, feedback: string[] | null = null): Promise<Epic> {
  if (settings.mockMode) {
    return getMockEpic(feedback ? feedback.length : 0);
  }

  const raw = await callClaudeJson<unknown>({
    system: SYSTEM_PROMPT,
    userMessage: buildUserPrompt(seed, feedback),
    maxTokens: 1500,
  });

  return parseEpic(raw);
}

// ─── Mock Fixtures ────────────────────────────────────────────────────────────
// Three progressively better epics. Iteration index picks the fixture.
// Teaching: inspect these to understand what scoring criteria look for.

function getMockEpic(iterationIndex: number): Epic {
  const fixtures: Epic[] = [
    // Iteration 0: Poor — vague outcome, no out-scope, weak metrics, no dependencies
    {
      title: "Improve Mobile Onboarding",
      outcome: "Make it easier for new users to get started with the app.",
      scope: {
        in: ["Redesign welcome screen", "Add tooltips", "Create tutorial flow"],
        out: [],
      },
      success_metrics: [
        { metric: "User satisfaction", target: "better", measurement: "surveys" },
      ],
      dependencies: [],
      risks: ["Technical complexity", "Resource constraints"],
    },
    // Iteration 1: Better — clearer outcome, some structure, still vague targets
    {
      title: "Streamline Mobile Onboarding for New Users",
      outcome: "Reduce onboarding drop-off for mobile users by improving the first-run experience.",
      scope: {
        in: [
          "Redesign 3-step welcome flow",
          "Add contextual tooltips on key features",
          "Create skip-able tutorial",
          "Add progress indicator",
        ],
        out: ["Desktop onboarding (separate epic)", "Existing user re-onboarding"],
      },
      success_metrics: [
        { metric: "Onboarding completion rate", target: "increase", measurement: "Mixpanel funnel" },
        { metric: "Time to first key action", target: "decrease", measurement: "Amplitude" },
      ],
      dependencies: ["Design team: new welcome screen mockups"],
      risks: [
        "A/B test requires 2-week minimum run time",
        "Tooltip library may conflict with React Native version",
      ],
    },
    // Iteration 2: Good — specific segment, numeric targets, named tools, clear deps
    {
      title: "Reduce Onboarding Drop-off for New Mobile Users",
      outcome:
        "Reduce onboarding completion drop-off for mobile users (iOS + Android) registered in the last 30 days from 58% to below 30% within 60 days of launch.",
      scope: {
        in: [
          "Redesign 3-step welcome flow with progress indicator",
          "Add contextual tooltips on Dashboard, Search, and Profile",
          "Create skip-able interactive tutorial (max 90 seconds)",
          "Implement onboarding completion event tracking",
        ],
        out: [
          "Desktop or web onboarding (tracked as separate epic)",
          "Re-onboarding for existing users (Q3 initiative)",
          "In-app chat or live support",
        ],
      },
      success_metrics: [
        {
          metric: "Onboarding completion rate",
          target: "> 70% within 7 days of install",
          measurement: "Mixpanel funnel: install → profile_complete event",
        },
        {
          metric: "Time to first key action",
          target: "< 3 minutes median",
          measurement: "Amplitude: session_start to first_search or first_save",
        },
        {
          metric: "7-day retention for new users",
          target: "> 40% (up from 27%)",
          measurement: "Amplitude retention cohort: registered in period",
        },
      ],
      dependencies: [
        "Design team: welcome flow mockups needed by sprint 1",
        "Analytics team: confirm Mixpanel funnel events are firing",
        "Mobile platform: confirm React Native Tooltip library compatibility",
      ],
      risks: [
        "A/B test requires 2-week run to reach significance — plan for delayed launch decision",
        "react-native-walkthrough-tooltip has known issues on Android 12+; spike needed in sprint 1",
        "Onboarding completion event missing from older app versions — funnel data may be incomplete",
      ],
    },
  ];

  return fixtures[Math.min(iterationIndex, fixtures.length - 1)];
}
