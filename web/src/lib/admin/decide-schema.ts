import { z } from "zod";

/**
 * One schema for the form and the route, so the browser and the server agree on what a decision
 * is. "Accept" confirms the pattern needs action. It is never a finding about the person.
 */
export const decideSchema = z.object({
  decision: z.enum(["ACCEPTED", "DECLINED"]),
  note: z.string().trim().max(500).optional(),
});

export type DecideBody = z.infer<typeof decideSchema>;

export const reverseHoldSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export type ReverseHoldBody = z.infer<typeof reverseHoldSchema>;
