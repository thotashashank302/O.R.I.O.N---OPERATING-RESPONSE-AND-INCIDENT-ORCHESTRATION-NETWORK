import { z } from "zod";

export const timelineEventSchema = z.object({
  id: z.string().uuid(),
  actorType: z.string(),
  action: z.string(),
  safePayload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

export type TimelineEvent = z.infer<typeof timelineEventSchema>;
