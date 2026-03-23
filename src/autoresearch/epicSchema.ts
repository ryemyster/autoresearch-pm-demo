// Zod schema for runtime validation of LLM-generated Epic JSON.
// Used only to validate what the LLM returns — fails fast if output is malformed.

import { z } from "zod";
import type { Epic } from "../shared/types/index.js";

export const epicSchema = z.object({
  title: z.string().min(1),
  outcome: z.string().min(1),
  scope: z.object({
    in: z.array(z.string()),
    out: z.array(z.string()),
  }),
  success_metrics: z.array(
    z.object({
      metric: z.string(),
      target: z.string(),
      measurement: z.string(),
    })
  ),
  dependencies: z.array(z.string()),
  risks: z.array(z.string()),
});

export function parseEpic(raw: unknown): Epic {
  return epicSchema.parse(raw) as Epic;
}
