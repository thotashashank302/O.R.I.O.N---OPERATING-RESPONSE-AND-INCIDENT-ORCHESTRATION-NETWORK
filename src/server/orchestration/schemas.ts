import { z } from "zod";
import { incidentPlanSchema } from "@/contracts/agents";
import { incidentContextSchema } from "@/contracts/domain";
export { specialistContextSchema } from "@/server/agents/specialist";

export const commanderContextSchema = z.object({
  incident: incidentContextSchema,
  eligibleProfiles: z.array(z.string().min(1)).min(1),
  priorPlan: incidentPlanSchema.nullable(),
  failureReason: z.string().max(1000).nullable(),
}).strict();
