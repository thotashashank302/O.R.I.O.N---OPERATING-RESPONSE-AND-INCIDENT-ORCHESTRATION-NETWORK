import { z } from "zod";

export const notificationSchema = z.object({
  id: z.string().uuid(),
  safeText: z.string().min(1),
  link: z.string().regex(/^\/(?!\/)/).nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  version: z.number().int().positive(),
});

export type Notification = z.infer<typeof notificationSchema>;
